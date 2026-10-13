"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, TouchEvent } from "react";
import { chapters, totalPages } from "./book-data";
import { chapterForPage, movePage } from "./book-navigation";
import styles from "./book.module.css";

const MOBILE_QUERY = "(max-width: 760px)";
const TURN_MS = 800;
function subscribeViewport(notify: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function mobileSnapshot() { return window.matchMedia(MOBILE_QUERY).matches; }
function serverSnapshot() { return false; }

type Turn = { from: number; to: number; direction: "forward" | "backward" };

function Arrow({ back = false }: { back?: boolean }) {
  return <svg viewBox="0 0 32 20" fill="none" aria-hidden="true"><path d={back ? "M30 10H2m0 0 8-8M2 10l8 8" : "M2 10h28m0 0-8-8m8 8-8 8"} stroke="currentColor" strokeWidth="1.3" /></svg>;
}

function PaperPage({ chapterIndex, onBegin }: { chapterIndex: number; onBegin?: () => void }) {
  const chapter = chapters[chapterIndex];
  return <article className={styles.paper} aria-label={`Page ${chapterIndex * 2 + 1}: ${chapter.label}`}>
    <div className={styles.runningHeader}><span>LITHUANIA / A BOOK OF DISCOVERIES</span><span>VOL. 01</span></div>
    <div className={styles.paperContent}>
      <div className={styles.chapterEyebrow}><span />{chapterIndex === 0 ? "A LETTER TO THE CURIOUS" : `CHAPTER ${String(chapterIndex).padStart(2, "0")} / ${chapter.category}`}</div>
      <div className={styles.insetPhoto} style={{ position: "relative" }}><Image src={chapter.image} alt="" fill sizes="(max-width: 760px) 90vw, 25vw" placeholder="blur" style={{ objectFit: "cover" }} /></div>
      <h1 className={styles.bookTitle}>{chapter.title}<br /><em>{chapter.italic}</em></h1>
      <p className={styles.intro}>{chapter.intro}</p>
      <p className={styles.bodyCopy}>{chapter.body}</p>
      {chapterIndex === 0 ? <button className={styles.startButton} onClick={onBegin}>Begin with Vilnius <Arrow /></button> : <p className={styles.marginNote}><span aria-hidden="true">✳</span>{chapter.note}</p>}
    </div>
    <div className={styles.paperFooter}><span>{chapter.category} / LITHUANIA</span><span className={styles.folio}>{String(chapterIndex * 2 + 1).padStart(2, "0")}</span></div>
  </article>;
}

function PhotoPage({ chapterIndex }: { chapterIndex: number }) {
  const chapter = chapters[chapterIndex];
  return <article className={styles.photo} style={{ position: "relative", isolation: "isolate" }} aria-label={`Page ${chapterIndex * 2 + 2}: ${chapter.photoTitle}`}>
    <Image src={chapter.image} alt={chapter.alt} fill preload={chapterIndex === 0} placeholder="blur" sizes="(max-width: 760px) 100vw, (max-width: 1100px) 48vw, 42vw" style={{ objectFit: "cover", objectPosition: chapterIndex === 1 ? "50% 65%" : "50% 50%" }} />
    <div className={styles.photoWash} />
    <div className={styles.photoTop}><span>+</span><span>FIELD NOTES / {chapter.category}</span><span>+</span></div>
    <div className={styles.photoCaption}><span className={styles.location}>⌖ &nbsp; {chapter.location}</span><h2>{chapter.photoTitle}</h2><p>{chapter.story}</p>{chapterIndex === chapters.length - 1 && <a className={styles.journeyLink} href="https://lithuania.travel/en" target="_blank" rel="noopener noreferrer">Continue your journey ↗</a>}</div>
    <a className={styles.photoCredit} href={chapter.source} target="_blank" rel="noopener noreferrer">{chapter.credit} / Unsplash ↗</a>
    <span className={styles.photoFolio}>{String(chapterIndex * 2 + 2).padStart(2, "0")}</span>
  </article>;
}

function Spread({ page, onBegin }: { page: number; onBegin?: () => void }) {
  const index = chapterForPage(page);
  return <div className={styles.spread} data-leaf={page % 2 === 0 ? "left" : "right"} style={{ "--chapter-accent": chapters[index].accent } as CSSProperties}><PaperPage chapterIndex={index} onBegin={onBegin} /><PhotoPage chapterIndex={index} /></div>;
}

export default function Home() {
  const singlePage = useSyncExternalStore(subscribeViewport, mobileSnapshot, serverSnapshot);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const currentPage = useRef(0);
  const turning = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const bookRegion = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activeChapter = chapterForPage(page);
  const firstVisiblePage = singlePage ? page : activeChapter * 2;
  const previous = movePage(page, -1, singlePage, totalPages);
  const next = movePage(page, 1, singlePage, totalPages);
  const atBeginning = singlePage ? page === 0 : activeChapter === 0;
  const atEnd = singlePage ? page === totalPages - 1 : activeChapter === chapters.length - 1;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    bookRegion.current?.querySelectorAll("article").forEach(article => { article.scrollTop = 0; });
  }, [page]);

  const goTo = useCallback((target: number) => {
    if (turning.current || target < 0 || target >= totalPages) return;
    setContentsOpen(false);
    bookRegion.current?.focus({ preventScroll: true });
    if (target === currentPage.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) {
      turning.current = true;
      setTurn({ from: currentPage.current, to: target, direction: target > currentPage.current ? "forward" : "backward" });
      timer.current = setTimeout(() => { setTurn(null); turning.current = false; }, TURN_MS);
    }
    currentPage.current = target;
    setPage(target);
  }, []);

  function onSwipe(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(dx < 0 ? next : previous);
  }

  // Listen at the window so arrow navigation also works before the reader is focused.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "Escape") { setContentsOpen(false); menuButton.current?.focus(); return; }
      let target: number | undefined;
      if (event.key === "ArrowRight") target = movePage(currentPage.current, 1, singlePage, totalPages);
      if (event.key === "ArrowLeft") target = movePage(currentPage.current, -1, singlePage, totalPages);
      if (event.key === "Home") target = 0;
      if (event.key === "End") target = singlePage ? totalPages - 1 : totalPages - 2;
      if (target === undefined) return;
      event.preventDefault();
      goTo(target);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [singlePage, goTo]);

  return <div className={styles.reader}>
    <a className={styles.skipLink} href="#book">Skip to the book</a>
    <aside id="book-contents" className={`${styles.sidebar} ${contentsOpen ? styles.sidebarOpen : ""}`} aria-label="Book contents">
      <button className={styles.brand} onClick={() => goTo(0)} aria-label="Return to the opening">lithuania<span>.</span><small>A BOOK OF DISCOVERIES</small></button>
      <div className={styles.sidebarIntro}><span aria-hidden="true">✳</span><p>A small country.<br />A world within.</p></div>
      <div className={styles.contentsLabel}><span>TABLE OF CONTENTS</span><span>5 CHAPTERS</span></div>
      <nav aria-label="Chapters"><ol className={styles.contents}>{chapters.map((chapter, index) => <li key={chapter.category}><button aria-current={activeChapter === index ? "page" : undefined} onClick={() => goTo(index * 2)} disabled={!!turn}><span className={styles.chapterNumber}>{String(index).padStart(2, "0")}</span><span>{chapter.label}<small>{chapter.category.toLowerCase()}</small></span><span className={styles.chapterRange}>{String(index * 2 + 1).padStart(2, "0")}</span></button></li>)}</ol></nav>
      <div className={styles.sidebarBottom}><span className={styles.compass} aria-hidden="true">N<br />✧</span><p>MADE FOR THE CURIOUS.<br />READ AT YOUR OWN PACE.</p><span>THE BALTIC EDITION / VOL. 01</span></div>
      <button className={styles.closeMenu} onClick={() => { setContentsOpen(false); menuButton.current?.focus(); }}>Close contents ×</button>
    </aside>
    {contentsOpen && <button className={styles.menuBackdrop} aria-label="Close contents" onClick={() => { setContentsOpen(false); menuButton.current?.focus(); }} />}
    <div className={styles.workspace}>
      <header className={styles.toolbar}><span>THE BALTIC EDITION <i>/</i> <span className={styles.toolbarChapter}>{chapters[activeChapter].subtitle}</span></span><button ref={menuButton} className={styles.contentsToggle} aria-expanded={contentsOpen} aria-controls="book-contents" onClick={() => setContentsOpen(!contentsOpen)}>Contents <span aria-hidden="true">☰</span></button><span className={styles.toolbarRight}>AN INTERACTIVE TRAVEL BOOK</span></header>
      <main className={styles.stage} id="book" ref={bookRegion} tabIndex={-1} aria-label={`${chapters[activeChapter].category}: page ${firstVisiblePage + 1}${singlePage ? "" : `–${activeChapter * 2 + 2}`}`} onTouchStart={event => { if (event.touches.length === 1) touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={onSwipe} onTouchCancel={() => { touchStart.current = null; }}>
        <div className={styles.book}>
          <Spread page={page} onBegin={() => goTo(2)} />
          {turn && <div className={`${styles.turnLayer} ${turn.direction === "forward" ? styles.forward : styles.backward}`} aria-hidden="true" inert style={{ "--chapter-accent": chapters[chapterForPage(turn.from)].accent } as CSSProperties}>
            <div className={styles.mobileTurnSnapshot}><Spread page={turn.from} /></div>
            <div className={styles.stationary}>{turn.direction === "forward" ? <PaperPage chapterIndex={chapterForPage(turn.from)} /> : <PhotoPage chapterIndex={chapterForPage(turn.from)} />}</div>
            <div className={styles.turnLeaf}><div className={styles.leafFront}>{turn.direction === "forward" ? <PhotoPage chapterIndex={chapterForPage(turn.from)} /> : <PaperPage chapterIndex={chapterForPage(turn.from)} />}</div><div className={styles.leafBack}>{turn.direction === "forward" ? <PaperPage chapterIndex={chapterForPage(turn.to)} /> : <PhotoPage chapterIndex={chapterForPage(turn.to)} />}</div></div>
          </div>}
          <div className={styles.spine} aria-hidden="true" />
        </div>
      </main>
      <footer className={styles.readerFooter}><div className={styles.readingProgress}><span>{String(singlePage ? page + 1 : activeChapter * 2 + 1).padStart(2, "0")}{!singlePage && `—${String(activeChapter * 2 + 2).padStart(2, "0")}`} <small>/ {totalPages}</small></span><div className={styles.progressTrack}><div style={{ width: `${((firstVisiblePage + (singlePage ? 1 : 2)) / totalPages) * 100}%` }} /></div></div><p className={styles.keyboardHint}>USE ← → TO TURN THE PAGE</p><div className={styles.pageControls}><button onClick={() => goTo(previous)} disabled={atBeginning || !!turn} aria-label="Previous page"><Arrow back /></button><span>{atEnd ? "END OF THE BOOK" : "TURN THE PAGE"}</span><button onClick={() => goTo(next)} disabled={atEnd || !!turn} aria-label="Next page"><Arrow /></button></div></footer>
      <span role="status" className={styles.srOnly}>{chapters[activeChapter].label}. Page {firstVisiblePage + 1}{!singlePage && ` and ${activeChapter * 2 + 2}`} of {totalPages}.</span>
    </div>
  </div>;
}
