import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Raio-X de Margem | Veja além do preço', description: 'Analise a margem dos seus produtos e simule descontos. Grátis, sem enviar seu catálogo.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="pt-BR"><body>{children}</body></html>; }
