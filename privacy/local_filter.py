"""Optional offline OpenAI privacy-filter adapter. Never sends input to an API.

Download the model separately before handling private data; this script only
loads local files. Model weights and Python dependencies are not bundled.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import time

# Set before importing any ML libraries; inference must not fetch remote files.
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

CATEGORIES = {'account_number', 'private_address', 'private_email', 'private_person',
              'private_phone', 'private_url', 'private_date', 'secret'}


def mask_spans(text, predictions):
    """Validate offsets and combine overlaps; never log raw detected words."""
    spans = []
    for item in predictions:
        label = item.get('entity_group', item.get('entity', ''))
        if label == 'O':
            continue
        if len(label) > 2 and label[:2] in ('B-', 'I-', 'E-', 'S-'):
            label = label[2:]
        if label not in CATEGORIES:
            raise ValueError('Unknown model label; refusing to release text.')
        start, end = item.get('start'), item.get('end')
        if not isinstance(start, int) or not isinstance(end, int) or not 0 <= start < end <= len(text):
            raise ValueError('Invalid model offsets; refusing to release text.')
        spans.append((start, end, label))
    spans.sort()
    merged = []
    for start, end, label in spans:
        if merged and start < merged[-1][1]:
            old_start, old_end, old_label = merged[-1]
            merged[-1] = (old_start, max(end, old_end), old_label if old_label == label else 'PII')
        else:
            merged.append((start, end, label))
    parts, cursor, counts = [], 0, {}
    for start, end, label in merged:
        parts.extend((text[cursor:start], f'[{label.upper()}]'))
        counts[label] = counts.get(label, 0) + 1
        cursor = end
    parts.append(text[cursor:])
    return ''.join(parts), {'occurrences': len(merged), 'categories': counts,
                           'redacted_characters': sum(end - start for start, end, _ in merged)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-dir', required=True, type=Path)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Use a separate output file; the original must not be overwritten.')
    if not (args.model_dir / 'config.json').is_file():
        parser.error('A local model download is required. See docs/PRIVACY.md.')
    text = args.input.read_text(encoding='utf-8')
    if len(text) > 100_000:
        parser.error('Input exceeds this adapter’s 100,000-character limit; split locally first.')
    from transformers import pipeline
    classifier = pipeline('token-classification', model=str(args.model_dir),
                          tokenizer=str(args.model_dir), device=-1)
    start = time.perf_counter()
    predictions = classifier(text, aggregation_strategy='simple')
    output, report = mask_spans(text, predictions)
    report.update({'model': 'openai/privacy-filter', 'inference_ms': (time.perf_counter() - start) * 1000,
                   'network': 'disabled', 'input_characters': len(text)})
    # Exclusive creation prevents accidentally replacing another document.
    with args.output.open('x', encoding='utf-8') as f:
        f.write(output)
    print(json.dumps(report))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Avoid library exceptions echoing private input or predictions.
        print(f'Local privacy filtering failed ({type(exc).__name__}); no unfiltered output was released.', file=sys.stderr)
        sys.exit(1)
