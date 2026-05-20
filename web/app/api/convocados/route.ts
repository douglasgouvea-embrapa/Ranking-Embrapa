import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCachedConvocados, CONVOCADOS_CACHE_TAG } from '@/lib/looker';

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    if (force) revalidateTag(CONVOCADOS_CACHE_TAG);
    const data = await getCachedConvocados();
    return NextResponse.json({
      convocados: data.convocados,
      total: data.total,
      atualizadoEm: data.fetchedAt,
      fonte: 'looker',
    });
  } catch (err) {
    console.error('Erro ao buscar convocados:', err);
    return NextResponse.json(
      { convocados: [], total: 0, atualizadoEm: null, fonte: 'erro', erro: String(err) },
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
