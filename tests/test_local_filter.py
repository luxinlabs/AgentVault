import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('local_filter', Path(__file__).parents[1] / 'privacy/local_filter.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LocalFilterTests(unittest.TestCase):
    def test_masking_and_no_raw_data_in_report(self):
        text, report = module.mask_spans('Alice lives here', [{'entity_group':'private_person','start':0,'end':5}])
        self.assertEqual(text, '[PRIVATE_PERSON] lives here')
        self.assertEqual(report['redacted_characters'], 5)
        self.assertNotIn('Alice', str(report))
    def test_invalid_offsets_fail_closed(self):
        with self.assertRaises(ValueError):
            module.mask_spans('Alice', [{'entity_group':'private_person','start':0,'end':99}])
    def test_overlap_and_unknown_label(self):
        text, report = module.mask_spans('Alice Smith', [{'entity':'B-private_person','start':0,'end':5},{'entity':'I-private_person','start':4,'end':11}])
        self.assertEqual(text, '[PRIVATE_PERSON]')
        self.assertEqual(report['occurrences'],1)
        with self.assertRaises(ValueError):
            module.mask_spans('Alice', [{'entity':'unknown','start':0,'end':5}])
if __name__ == '__main__':
    unittest.main()
