import Link from "next/link";

export default function NotFound() {
  return (
    <div className="brand-field grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Erro 404</p>
        <h1 className="mt-4 text-[clamp(2.2rem,7vw,3.6rem)] font-black uppercase leading-[0.95] tracking-[-0.03em] text-[#1E2B6B]">
          Página não
          <span className="mt-1 block font-script text-[1.06em] font-normal normal-case tracking-normal text-white">
            encontrada
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-[42ch] text-[15px] leading-relaxed text-white/85">
          O endereço acessado não existe neste painel. Volte ao início para carregar os dados da
          campanha.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-pill border border-white/35 px-7 py-3.5 text-[13px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/10"
          >
            Voltar ao início
          </Link>
          <Link
            href="/visao-geral"
            className="rounded-pill bg-brand-yellow px-7 py-3.5 text-[13px] font-black uppercase tracking-[0.1em] text-[#16255F] transition hover:brightness-105"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  );
}
