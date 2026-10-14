'use client';

import { useEffect, useRef, useState } from 'react';
import { CirclePlay, Clock3, X } from 'lucide-react';
import styles from './tutorial-dialog.module.css';

const VIDEO_URL = 'https://github.com/bittencourtthulio/raio-x-margem/releases/download/tutorial-primeiros-passos-v1/primeiros-passos-raio-x.mp4';
const storageKey = (accountId: string) => `rxm:tutorial:v1:${accountId}`;

export default function TutorialDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(storageKey(accountId))) return;
      } catch { /* The tutorial remains usable when browser storage is unavailable. */ }
      setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [accountId]);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  function rememberDismissal() {
    try { localStorage.setItem(storageKey(accountId), 'dismissed'); } catch { /* Optional browser preference. */ }
  }

  function dismiss() {
    rememberDismissal();
    setOpen(false);
    video.current?.pause();
    dialog.current?.close();
  }

  function onClose() {
    video.current?.pause();
    setOpen(false);
    rememberDismissal();
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setVideoError(false); setOpen(true); }}>
      <CirclePlay size={18} aria-hidden="true" /> Como usar
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="tutorial-title" aria-describedby="tutorial-description" onClose={onClose} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
    }}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>COMECE COM CLAREZA</span>
          <h2 id="tutorial-title">Seu primeiro Raio-X.</h2>
          <p id="tutorial-description">Da importação do arquivo à leitura das margens. Acompanhe o passo a passo.</p>
        </div>
        <button type="button" className={styles.close} aria-label="Fechar aula" onClick={dismiss} autoFocus><X size={22} aria-hidden="true" /></button>
      </div>
      <div className={styles.player}>
        {open && <video ref={video} controls playsInline preload="metadata" poster="/tutorial/primeiros-passos.jpg" aria-label="Aula de primeiros passos no Raio-X de Margem" onError={() => setVideoError(true)}>
          <source src={VIDEO_URL} type="video/mp4" />
          <track kind="captions" src="/tutorial/primeiros-passos.vtt" srcLang="pt-BR" label="Português" />
          Seu navegador não suporta este vídeo.
        </video>}
      </div>
      {videoError && <p className={styles.error} role="status">Não foi possível carregar a aula. <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer">Abrir o vídeo em outra aba</a> ou tente novamente mais tarde.</p>}
      <div className={styles.footer}>
        <span><Clock3 size={16} aria-hidden="true" /> Cerca de 5 minutos <span className={styles.dot}>·</span> Assista quando quiser pelo botão “Como usar”.</span>
        <button type="button" className={styles.continue} onClick={dismiss}>Continuar para a ferramenta</button>
      </div>
    </dialog>
  </>;
}
