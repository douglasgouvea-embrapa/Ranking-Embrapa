import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ranking Concurso Embrapa — Acompanhamento de Convocações',
  description: 'Acompanhe a classificação e o status de convocação dos aprovados no concurso público da Embrapa (Edital 2024).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
