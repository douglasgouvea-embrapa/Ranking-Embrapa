import { Header } from '@/components/Header';
import { Explorer } from '@/components/Explorer';
import type { OpcaoSummary } from '@/components/Explorer';
import { Footer } from '@/components/Footer';
import { CARGO_GROUPS, getOpcoesByGroup } from '@/lib/data';

async function fetchConvocadosMeta() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;
    const res = await fetch(`${baseUrl}/api/convocados`, { next: { revalidate: 60 } });
    if (!res.ok) return { total: 0, atualizadoEm: null as string | null };
    const data = await res.json();
    return { total: data.total ?? 0, atualizadoEm: data.atualizadoEm ?? null };
  } catch {
    return { total: 0, atualizadoEm: null as string | null };
  }
}

export default async function Home() {
  const groups = CARGO_GROUPS.map(g => ({
    id: g.id,
    label: g.label,
    opcoes: getOpcoesByGroup(g.id).map<OpcaoSummary>(o => ({
      opcao: o.opcao,
      cargo: o.cargo,
      area: o.area,
      subarea: o.subarea,
      totalGeral: o.geral.length,
      totalPcd: o.pcd.length,
      totalPpp: o.ppp.length,
    })),
  }));

  const { total, atualizadoEm } = await fetchConvocadosMeta();

  return (
    <>
      <Header convocadosCount={total} atualizadoEm={atualizadoEm} />
      <Explorer groups={groups} />
      <Footer />
    </>
  );
}
