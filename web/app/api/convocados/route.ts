import { NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import { fetchConvocadosFromLooker } from '@/lib/looker';

const CACHE_TAG = 'convocados';
const ONE_DAY = 86400;

const cachedFetch = unstable_cache(
  async () => fetchConvocadosFromLooker(),
  ['convocados-looker'],
  { revalidate: ONE_DAY, tags: [CACHE_TAG] },
);

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1';

  try {
    if (force) revalidateTag(CACHE_TAG);
    const data = await cachedFetch();
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
  revalidateTag(CACHE_TAG);
  try {
    const data = await cachedFetch();
    return NextResponse.json({
      ok: true,
      total: data.total,
      atualizadoEm: data.fetchedAt,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) }, { status: 502 });
  }
}
