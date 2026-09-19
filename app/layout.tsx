import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { metadataBase: new URL('https://agentvault-financial-firewall.beige-horse-1963.chatgpt.site'), title: 'AgentVault — The financial firewall for AI agents', description: 'Trace intent. Enforce policy. Stop invoice fraud before an AI agent moves money.', openGraph: { title: 'AgentVault', description: 'The financial firewall for AI agents', type: 'website', images: [{ url: '/og.png', width: 1730, height: 909, alt: 'AgentVault — The financial firewall for AI agents' }] }, twitter: { card: 'summary_large_image', images: ['/og.png'], title: 'AgentVault', description: 'The financial firewall for AI agents' } };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="en"><body>{children}</body></html>; }
