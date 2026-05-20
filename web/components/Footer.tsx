export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-gray-500">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="font-semibold text-embrapa-ink">Ranking Concurso Embrapa</p>
            <p className="mt-0.5">
              Dados extraídos dos editais oficiais (n.º 40, 42 e 45 de 2025) e cruzados com a fonte de convocações.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://datastudio.google.com/u/0/reporting/081070ee-89c7-4e57-85bc-04d4601aa513/page/qD6ZF"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-embrapa-green px-4 py-1.5 text-xs font-semibold text-white hover:bg-embrapa-green-dark"
            >
              Ver dashboard original ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
