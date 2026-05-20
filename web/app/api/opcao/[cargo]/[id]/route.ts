import { NextResponse } from 'next/server';
import { getOpcao, CARGO_GROUPS } from '@/lib/data';
import { gerarChamadas, tabelaOf } from '@/lib/chamadas';
import vagasData from '@/data/vagas.json';
import type { CargoKey, Vagas } from '@/lib/types';

const VAGAS = vagasData as Record<string, Vagas>;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cargo: string; id: string }> },
) {
  const { cargo, id } = await params;

  const group = CARGO_GROUPS.find(g => g.id === cargo);
  const cargosToSearch: CargoKey[] = group ? group.cargos : [cargo as CargoKey];

  for (const c of cargosToSearch) {
    const opcao = getOpcao(c, id);
    if (opcao) {
      const chamadas = gerarChamadas(opcao);
      return NextResponse.json({
        ...opcao,
        tabela: tabelaOf(opcao.opcao),
        chamadas,
        vagas: VAGAS[opcao.opcao] ?? null,
      });
    }
  }

  return NextResponse.json({ error: 'Opção não encontrada' }, { status: 404 });
}
