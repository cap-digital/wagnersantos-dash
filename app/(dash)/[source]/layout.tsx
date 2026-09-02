import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataProvider } from "@/components/DataProvider";
import { DataGate } from "@/components/DataGate";
import { FilterBar } from "@/components/FilterBar";
import { TopBar } from "@/components/TopBar";
import { SOURCES, SOURCE_INFO, isSourceId } from "@/lib/sources";

type Params = { source: string };

/**
 * Both panels are the same dashboard over a different data source, so they are
 * one route with the source in the path rather than two copies of the tree.
 * Everything below this point — filters, charts, tables — is shared verbatim.
 */
export function generateStaticParams(): Params[] {
  return SOURCES.map((source) => ({ source }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  if (!isSourceId(params.source)) return {};
  return { title: SOURCE_INFO[params.source].title };
}

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  if (!isSourceId(params.source)) notFound();
  const source = SOURCE_INFO[params.source];

  return (
    <DataProvider source={source.id}>
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
            <span>© 2026 Wagner Santos · Candidato a Deputado Estadual — Bahia</span>
            <span>{source.footer}</span>
          </p>
        </footer>
      </div>
    </DataProvider>
  );
}
