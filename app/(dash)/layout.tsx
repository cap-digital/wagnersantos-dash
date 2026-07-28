import { DataProvider } from "@/components/DataProvider";
import { DataGate } from "@/components/DataGate";
import { FilterBar } from "@/components/FilterBar";
import { TopBar } from "@/components/TopBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="page-field min-h-screen">
        <TopBar />
        {/* The header is one row at every width now, so the offset no longer
            needs a taller mobile variant. */}
        <main className="mx-auto max-w-[1440px] px-3 pb-20 pt-[104px] sm:px-5">
          <FilterBar />
          <DataGate>{children}</DataGate>
        </main>
        <footer className="mx-auto max-w-[1440px] px-5 pb-10">
          <div className="dash-rule h-px w-full" />
          <p className="mt-4 flex flex-wrap justify-between gap-2 text-[11.5px] text-ink-3">
            <span>© 2026 Wagner Santos · Pré-candidato a Deputado Estadual — Bahia</span>
            <span>Dados de Meta Ads · Conteúdo de pré-campanha.</span>
          </p>
        </footer>
      </div>
    </DataProvider>
  );
}
