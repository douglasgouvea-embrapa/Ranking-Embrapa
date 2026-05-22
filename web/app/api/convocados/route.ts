import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCachedConvocados, CONVOCADOS_CACHE_TAG } from '@/lib/looker';
import { reconcileSnapshot, isKvConfigured } from '@/lib/snapshot';
import { computeProximosConvocados } from '@/lib/dashboard';

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    if (force) revalidateTag(CONVOCADOS_CACHE_TAG);
    const data = await getCachedConvocados();

    const diff = await reconcileSnapshot(data.convocados, data.total, data.fetchedAt);
    const proximos = computeProximosConvocados(data.convocados);

    return NextResponse.json({
      convocados: data.convocados,
      total: data.total,
      atualizadoEm: data.fetchedAt,
      fonte: 'looker',
      novidades: diff.novidades,
      snapshotAnterior: diff.snapshotAnterior,
      proximos,
      kvAtivo: isKvConfigured(),
    });
  } catch (err) {
    console.error('Erro ao buscar convocados:', err);
    return NextResponse.json(
      {
        convocados: [],
        total: 0,
        atualizadoEm: null,
        fonte: 'erro',
        erro: String(err),
        novidades: [],
        snapshotAnterior: null,
        proximos: [],
        kvAtivo: isKvConfigured(),
      },
      { status: 502 },
    );
  }
}

export async function POST() {
  revalidateTag(CONVOCADOS_CACHE_TAG);
  try {
    const data = await getCachedConvocados();
    return NextResponse.json({
      ok: true,
      total: data.total,
      atualizadoEm: data.fetchedAt,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) }, { status: 502 });
  }
}
