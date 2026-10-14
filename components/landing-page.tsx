"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Fingerprint,
  Menu,
  MousePointer2,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  Upload,
  X,
} from "lucide-react";
import styles from "./landing-page.module.css";

type LandingPageProps = { onStart: () => void; onDemo: () => void; onLogin: () => void };

const examples = [
  { name: "Camiseta básica", cost: 6000, price: 10000, color: "green" },
  { name: "Tênis casual", cost: 14500, price: 18000, color: "orange" },
  { name: "Boné clássico", cost: 5500, price: 5000, color: "red" },
];
const percent = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      href="#inicio"
      className={`${styles.brand} ${light ? styles.brandLight : ""}`}
      aria-label="Raio-X de Margem — início"
    >
      <span className={styles.brandIcon}>
        <ScanLine size={24} strokeWidth={1.7} />
      </span>
      <span>
        raio<span className={styles.brandX}>×</span>
        <span className={styles.brandSub}>de margem</span>
      </span>
    </a>
  );
}

function HeroDashboard() {
  const [discount, setDiscount] = useState(0);
  const products = examples.map((product) => {
    const simulated = Math.round((product.price * (100 - discount)) / 100);
    return {
      ...product,
      simulated,
      margin: ((simulated - product.cost) / simulated) * 100,
    };
  });
  const below = products.filter((product) => product.margin < 20).length;
  return (
    <div className={styles.dashboard}>
      <div className={styles.dashTop}>
        <span className={styles.dashLogo}>
          <ScanLine size={18} /> Seu raio-x de margem
        </span>
        <span className={styles.demoLabel}>DEMONSTRAÇÃO</span>
      </div>
      <div className={styles.dashBody}>
        <div className={styles.dashHeading}>
          <div>
            <span className={styles.smallLabel}>VISÃO DOS PRODUTOS</span>
            <h3>Clareza para decidir.</h3>
          </div>
          <span className={styles.fileBadge}>
            <FileSpreadsheet size={13} /> exemplo.csv
          </span>
        </div>
        <div className={styles.dashMetrics}>
          <div>
            <span>Produtos analisados</span>
            <strong>
              03<span className={styles.metricSmall}>cadastros</span>
            </strong>
            <span className={styles.metricFoot}>
              <Check size={12} /> Dados de exemplo
            </span>
          </div>
          <div className={styles.attentionMetric}>
            <span>Abaixo da sua meta</span>
            <strong>
              0{below}
              <ArrowDownRight size={28} />
            </strong>
            <span className={styles.metricFoot}>Meta demonstrativa: 20%</span>
          </div>
        </div>
        <div className={styles.chartHeader}>
          <strong>Margem por produto</strong>
          <span>Bruta estimada</span>
        </div>
        <div className={styles.productChart}>
          {products.map((product) => (
            <div className={styles.productRow} key={product.name}>
              <div className={styles.productLabels}>
                <span>{product.name}</span>
                <strong
                  className={
                    product.margin < 0
                      ? styles.negative
                      : product.margin < 20
                        ? styles.warning
                        : styles.positive
                  }
                >
                  {percent(product.margin)}
                </strong>
              </div>
              <div className={styles.barTrack}>
                <span
                  className={
                    product.margin < 0
                      ? styles.barRed
                      : product.margin < 20
                        ? styles.barOrange
                        : styles.barGreen
                  }
                  style={{
                    transform: `scaleX(${Math.min(Math.abs(product.margin) / 50, 1)})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.discountControl}>
          <div>
            <label htmlFor="hero-discount">
              <SlidersHorizontal size={14} /> E se você der um desconto?
            </label>
            <output htmlFor="hero-discount">{discount}%</output>
          </div>
          <input
            id="hero-discount"
            type="range"
            min="0"
            max="30"
            step="1"
            value={discount}
            onChange={(event) => setDiscount(Number(event.target.value))}
            style={{ "--range": `${(discount / 30) * 100}%` } as CSSProperties}
          />
          <div className={styles.rangeLabels}>
            <span>0%</span>
            <span>Arraste e veja a margem mudar</span>
            <span>30%</span>
          </div>
        </div>
        <p className={styles.dashDisclaimer}>
          Exemplo ilustrativo. Margem bruta não é lucro líquido.
        </p>
      </div>
    </div>
  );
}

const questions = [
  [
    "É gratuito mesmo? Preciso me cadastrar?",
    "Sim, a análise e a simulação são gratuitas. Para acessar a ferramenta, crie sua conta com Google e complete os dados do seu negócio. Nos próximos acessos, basta entrar na mesma conta.",
  ],
  [
    "Que arquivo posso usar?",
    "Use um CSV em UTF-8 com nome do produto, custo unitário e preço de venda. O código de barras é opcional. São aceitos arquivos de até 2 MB e 5.000 registros. Você poderá conferir as colunas e escolher o formato numérico antes de analisar.",
  ],
  [
    "Minha planilha fica salva?",
    "Não. O CSV é processado na memória do seu navegador, sem upload do catálogo. Se você fechar ou recarregar a página, será necessário importar novamente. O diagnóstico opcional utiliza apenas indicadores agregados, sem nomes, códigos ou preços individuais dos produtos.",
  ],
  [
    "A ferramenta calcula o lucro da minha loja?",
    "Não. Ela mostra a margem bruta estimada por produto ou a contribuição estimada quando você informa uma taxa variável. Despesas fixas, volume de vendas e outros custos não estão incluídos. Confira se o custo informado inclui os custos de aquisição relevantes.",
  ],
  [
    "Posso testar antes de importar meus produtos?",
    "Sim. Depois de criar sua conta ou entrar, o botão de demonstração abre uma análise com dados de exemplo. Você pode explorar os resultados e simular descontos antes de usar seu próprio CSV.",
  ],
  [
    "Vou receber contato comercial?",
    "Somente se você autorizar. No cadastro da sua conta, a autorização para contato sobre o software de gestão fica desmarcada por padrão. Recusar esse contato não impede o diagnóstico.",
  ],
];

export function LandingPage({ onStart, onDemo, onLogin }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.12 },
    );
    if (!reduced.matches)
      elements.forEach((element) => {
        element.classList.add(styles.revealReady);
        observer.observe(element);
      });
    let frame = 0;
    const updateScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const total =
          document.documentElement.scrollHeight - window.innerHeight;
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${total > 0 ? Math.min(window.scrollY / total, 1) : 0})`;
        frame = 0;
      });
    };
    const updatePreference = () => {
      if (reduced.matches)
        elements.forEach((element) => element.classList.add(styles.revealed));
    };
    window.addEventListener("scroll", updateScroll, { passive: true });
    reduced.addEventListener("change", updatePreference);
    updateScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      reduced.removeEventListener("change", updatePreference);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual || motionPaused) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = visual.getBoundingClientRect();
        const x = (clientX - bounds.left) / bounds.width - 0.5;
        const y = (clientY - bounds.top) / bounds.height - 0.5;
        visual.style.setProperty("--rotate-x", `${-y * 7}deg`);
        visual.style.setProperty("--rotate-y", `${x * 9}deg`);
        visual.style.setProperty("--mouse-x", `${50 + x * 30}%`);
        visual.style.setProperty("--mouse-y", `${50 + y * 30}%`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      visual.style.setProperty("--rotate-x", "0deg");
      visual.style.setProperty("--rotate-y", "0deg");
    };
    visual.addEventListener("pointermove", move);
    visual.addEventListener("pointerleave", reset);
    return () => {
      visual.removeEventListener("pointermove", move);
      visual.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [motionPaused]);

  const start = () => {
    setMenuOpen(false);
    onStart();
  };

  return (
    <div
      ref={rootRef}
      id="inicio"
      className={`${styles.landing} ${motionPaused ? styles.paused : ""}`}
    >
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>
      <div
        ref={progressRef}
        className={styles.scrollProgress}
        aria-hidden="true"
      />
      <header className={styles.header}>
        <div className={styles.navInner}>
          <Brand />
          <nav
            aria-label="Navegação principal"
            className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}
          >
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>
              Como funciona
            </a>
            <a href="#por-que-usar" onClick={() => setMenuOpen(false)}>
              Por que usar
            </a>
            <a href="#duvidas" onClick={() => setMenuOpen(false)}>
              Dúvidas
            </a>
          </nav>
          <button className={styles.loginButton} onClick={onLogin}>Entrar</button>
          <button className={styles.navCta} onClick={start}>
            Criar conta grátis <ArrowUpRight />
          </button>
          <button
            className={styles.menuButton}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="conteudo">
        <section
          className={`${styles.hero} ${styles.container}`}
          aria-labelledby="hero-title"
        >
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} /> MENOS ACHISMO. MAIS CLAREZA.
            </div>
            <h1 id="hero-title">
              Seu preço vende.
              <br />
              Mas a{" "}
              <span className={styles.marginWord}>
                margem
                <svg
                  viewBox="0 0 360 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M4 12 Q160 -3 353 9 M18 17 Q180 5 336 13" />
                </svg>
              </span>
              <br />
              fecha?
            </h1>
            <p className={styles.heroDescription}>
              Descubra quais produtos estão abaixo da margem que você deseja.
              Simule descontos e veja o que merece atenção{" "}
              <strong>antes da próxima venda.</strong>
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} onClick={start}>
                Analisar meus produtos grátis <ArrowRight size={19} />
              </button>
              <button className={styles.demoButton} onClick={onDemo}>
                <span className={styles.playIcon}>▶</span> Experimentar uma
                demonstração
              </button>
            </div>
            <div className={styles.heroTrust}>
              <span>
                <Check size={14} /> Acesso gratuito com sua conta
              </span>
              <span>
                <Check size={14} /> Seu CSV fica no navegador
              </span>
            </div>
            <a href="#como-funciona" className={styles.scrollHint}>
              <span>
                <ArrowDown size={16} />
              </span>{" "}
              OS NÚMEROS CONTAM UMA HISTÓRIA. VEJA A SUA.
            </a>
          </div>
          <div className={styles.heroVisual} ref={visualRef}>
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.orbitTwo} aria-hidden="true" />
            <span className={styles.decorPlus} aria-hidden="true">
              +
            </span>
            <span className={styles.decorStar} aria-hidden="true">
              ✳
            </span>
            <div className={styles.visualInner}>
              <div className={styles.floatingNote}>
                <span>
                  <TrendingDown size={18} />
                </span>
                <div>
                  <strong>Nem todo desconto compensa.</strong>
                  <small>Veja o efeito antes de decidir.</small>
                </div>
              </div>
              <HeroDashboard />
              <div className={styles.safeNote}>
                <span>
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong>Seus produtos ficam com você.</strong>
                  <small>Sem upload do seu catálogo.</small>
                </div>
                <span className={styles.safeDot} />
              </div>
            </div>
            <div className={styles.visualCaption}>
              <MousePointer2 size={13} />
              <span>Explore os números. O painel é interativo.</span>
              <button
                onClick={() => setMotionPaused(!motionPaused)}
                aria-pressed={motionPaused}
              >
                {motionPaused ? "Ativar movimento" : "Pausar movimento"}
              </button>
            </div>
          </div>
        </section>

        <div className={styles.trustStrip}>
          <div className={styles.container}>
            <span>
              FEITO PARA QUEM
              <br />
              <strong>cuida do próprio negócio.</strong>
            </span>
            <span>
              <FileSpreadsheet /> Da sua planilha à análise
            </span>
            <span>
              <SlidersHorizontal /> Descontos sem adivinhação
            </span>
            <span>
              <Fingerprint /> Catálogo no seu navegador
            </span>
          </div>
        </div>

        <section
          id="como-funciona"
          className={`${styles.howSection} ${styles.container}`}
          aria-labelledby="how-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <div>
              <span className={styles.eyebrow}>DA PLANILHA À CLAREZA</span>
              <h2 id="how-title">
                Seus números.
                <br />
                Uma nova perspectiva.
              </h2>
            </div>
            <p>
              Você já tem os dados.
              <br />
              Agora, descubra o que eles dizem
              <br className={styles.desktopBreak} /> sobre os seus preços.
            </p>
          </div>
          <div className={styles.steps}>
            <article data-reveal>
              <div className={styles.stepTop}>
                <span>01 / IMPORTE</span>
                <Upload size={23} />
              </div>
              <div className={styles.stepIllustration}>
                <div className={styles.miniFile}>
                  <FileSpreadsheet size={23} />
                  <span>seus-produtos.csv</span>
                  <Check size={15} />
                </div>
                <div className={styles.miniFileLines}>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <h3>Comece com o que você já tem.</h3>
              <p>
                Exporte um CSV com nome, custo e preço de venda. Confira as
                colunas antes de seguir.
              </p>
              <a href="/modelo-produtos.csv" download>
                Baixar planilha modelo <ArrowDown size={14} />
              </a>
            </article>
            <article data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
              <div className={styles.stepTop}>
                <span>02 / DESCUBRA</span>
                <ScanLine size={23} />
              </div>
              <div className={styles.stepIllustration}>
                <div className={styles.miniBars}>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <span className={styles.miniTag}>Atenção à margem</span>
              </div>
              <h3>Encontre o que pede atenção.</h3>
              <p>
                Veja produtos abaixo da sua meta, resultados negativos e dados
                que merecem conferência.
              </p>
              <span className={styles.stepFoot}>
                Sua meta. Seus critérios. <Check size={14} />
              </span>
            </article>
            <article
              data-reveal
              style={{ "--delay": "160ms" } as CSSProperties}
            >
              <div className={styles.stepTop}>
                <span>03 / SIMULE</span>
                <SlidersHorizontal size={23} />
              </div>
              <div className={styles.stepIllustration}>
                <div className={styles.miniSimulation}>
                  <span>Desconto</span>
                  <strong>
                    10<span>%</span>
                  </strong>
                  <div>
                    <i />
                  </div>
                </div>
                <span className={styles.simulationArrow}>
                  <ArrowDownRight size={24} />
                </span>
              </div>
              <h3>Teste antes de dar o desconto.</h3>
              <p>
                Altere o desconto e acompanhe o efeito na margem de cada
                produto. Decida com os dados à vista.
              </p>
              <span className={styles.stepFoot}>
                Sem alterar os seus preços. <Check size={14} />
              </span>
            </article>
          </div>
        </section>

        <section
          id="por-que-usar"
          className={styles.insightSection}
          aria-labelledby="insight-title"
        >
          <div className={`${styles.container} ${styles.insightGrid}`}>
            <div className={styles.insightCopy} data-reveal>
              <span className={styles.eyebrow}>
                UM DESCONTO PEQUENO. UM EFEITO NEM TANTO.
              </span>
              <h2 id="insight-title">
                10% de desconto.
                <br />
                Quanto sobra
                <br />
                <span>da sua margem?</span>
              </h2>
              <p>
                Um produto custa R$ 60 e é vendido por R$ 100. Com 10% de
                desconto, a margem bruta cai de 40% para 33,3%.
              </p>
              <p>
                O preço muda um pouco.
                <br />
                <strong>O resultado merece um olhar mais atento.</strong>
              </p>
              <button className={styles.textButton} onClick={onDemo}>
                Simular com dados de exemplo <ArrowRight size={18} />
              </button>
            </div>
            <div className={styles.receiptScene} data-reveal>
              <span className={styles.receiptAnnotation}>
                Vamos colocar na ponta do lápis.
                <svg viewBox="0 0 90 55" aria-hidden="true">
                  <path d="M2 2 Q85 2 65 46 M53 34 L65 47 L78 34" />
                </svg>
              </span>
              <div className={styles.receipt}>
                <div className={styles.receiptLogo}>
                  <ScanLine size={20} /> UM PRODUTO. DOIS CENÁRIOS.
                </div>
                <div className={styles.receiptColumns}>
                  <span>Preço original</span>
                  <span>Com 10% off</span>
                </div>
                <div className={styles.receiptPrices}>
                  <strong>
                    R$ 100<span>,00</span>
                  </strong>
                  <ArrowRight size={20} />
                  <strong>
                    R$ 90<span>,00</span>
                  </strong>
                </div>
                <div className={styles.receiptLine}>
                  <span>Custo do produto</span>
                  <span>R$ 60,00</span>
                </div>
                <div className={styles.receiptDivider} />
                <div className={styles.receiptColumns}>
                  <span>Margem original</span>
                  <span>Margem com desconto</span>
                </div>
                <div className={styles.receiptMargins}>
                  <strong>
                    40<span>%</span>
                  </strong>
                  <ArrowDownRight size={27} />
                  <strong>
                    33,3<span>%</span>
                  </strong>
                </div>
                <div className={styles.receiptResult}>
                  <span>Resultado bruto por unidade</span>
                  <strong>
                    R$ 40,00 <ArrowRight size={14} /> R$ 30,00
                  </strong>
                </div>
                <p>
                  Exemplo sem taxas ou despesas fixas.
                  <br />
                  Margem bruta estimada não é lucro líquido.
                </p>
                <div className={styles.receiptBarcode} aria-hidden="true" />
              </div>
              <span className={styles.receiptSticker}>
                Antes de dar
                <br />
                desconto,
                <br />
                <strong>faça as contas.</strong>
              </span>
            </div>
          </div>
        </section>

        <section
          className={`${styles.benefitsSection} ${styles.container}`}
          aria-labelledby="benefits-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <div>
              <span className={styles.eyebrow}>
                SIMPLES DE USAR. ÚTIL PARA DECIDIR.
              </span>
              <h2 id="benefits-title">
                Menos planilha aberta.
                <br />
                Mais perguntas respondidas.
              </h2>
            </div>
            <span className={styles.sectionSymbol} aria-hidden="true">
              ✳
            </span>
          </div>
          <div className={styles.benefitGrid}>
            <article data-reveal>
              <span className={styles.benefitIcon}>
                <BarChart3 />
              </span>
              <h3>A margem aparece.</h3>
              <p>
                Gráfico, ranking e tabela mostram quais produtos estão abaixo da
                meta que você definiu.
              </p>
              <span>Encontre. Compare. Confira.</span>
            </article>
            <article data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
              <span className={styles.benefitIcon}>
                <SlidersHorizontal />
              </span>
              <h3>O cenário muda com você.</h3>
              <p>
                Simule desconto e taxa variável. Veja como cada escolha muda o
                resultado por produto.
              </p>
              <span>Sem mexer no seu cadastro original.</span>
            </article>
            <article
              data-reveal
              style={{ "--delay": "160ms" } as CSSProperties}
            >
              <span className={styles.benefitIcon}>
                <ShieldCheck />
              </span>
              <h3>Seu catálogo é seu.</h3>
              <p>
                A análise acontece no navegador. Seu arquivo e seus produtos não
                são enviados ao servidor.
              </p>
              <span>Clareza também sobre os seus dados.</span>
            </article>
          </div>
        </section>

        <section
          className={`${styles.diagnosticBanner} ${styles.container}`}
          data-reveal
        >
          <span className={styles.diagnosticIcon}>
            <Sparkles size={28} />
          </span>
          <div>
            <span className={styles.eyebrow}>
              UM PRÓXIMO PASSO, SE VOCÊ QUISER
            </span>
            <h3>Da análise a uma lista do que conferir.</h3>
            <p>
              Depois de explorar os números, solicite um diagnóstico
              interpretado usando os dados da sua conta. Você escolhe se autoriza
              contato comercial.
            </p>
          </div>
          <button className={styles.outlineButton} onClick={start}>
            Começar pela análise <ArrowRight size={17} />
          </button>
        </section>

        <section
          id="duvidas"
          className={`${styles.faqSection} ${styles.container}`}
          aria-labelledby="faq-title"
        >
          <div data-reveal>
            <span className={styles.eyebrow}>SEM PONTAS SOLTAS</span>
            <h2 id="faq-title">
              Antes de
              <br />
              começar.
            </h2>
            <p>
              O que você precisa saber
              <br />
              para dar o primeiro passo.
            </p>
          </div>
          <div className={styles.faqList} data-reveal>
            {questions.map(([question, answer], index) => (
              <div
                key={question}
                className={`${styles.faqItem} ${openFaq === index ? styles.faqOpen : ""}`}
              >
                <h3>
                  <button
                    id={`faq-trigger-${index}`}
                    aria-expanded={openFaq === index}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  >
                    {question}
                    <ChevronDown size={18} />
                  </button>
                </h3>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  hidden={openFaq !== index}
                >
                  <p>{answer}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalOrbit} aria-hidden="true" />
          <div className={styles.container} data-reveal>
            <span className={styles.eyebrow}>
              SEUS PRODUTOS TÊM ALGO A DIZER.
            </span>
            <h2 id="final-title">
              Bora olhar para
              <br />a sua <span>margem?</span>
            </h2>
            <p>
              Importe seus produtos. Encontre os pontos de atenção.
              <br />
              Dê o próximo desconto com mais clareza.
            </p>
            <button className={styles.primaryButton} onClick={start}>
              Analisar meus produtos grátis <ArrowRight size={19} />
            </button>
            <span className={styles.finalTrust}>
              <Check size={14} /> Crie sua conta grátis para analisar.
            </span>
          </div>
          <span className={styles.finalStar} aria-hidden="true">
            ✳
          </span>
        </section>
      </main>
      <footer className={`${styles.footer} ${styles.container}`}>
        <Brand />
        <p>
          Um olhar mais claro para os seus preços.
          <br />
          <span>
            Margem estimada por produto. Não representa lucro líquido.
          </span>
        </p>
        <a href="/privacidade">
          Dados e privacidade <ArrowUpRight />
        </a>
      </footer>
    </div>
  );
}

function ArrowUpRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
