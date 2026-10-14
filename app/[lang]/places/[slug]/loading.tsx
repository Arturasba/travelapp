"use client";
import Link from "next/link";
import styles from "../../../guide.module.css";
import { useLocale } from "../../../locale-context";
import { translator } from "../../../i18n";

export default function DestinationLoading() {
  const locale=useLocale();const t=translator(locale);
  return <main className={styles.routeLoading} aria-busy="true">
    <Link href={`/${locale}`}>← {t("Back to Explore")}</Link>
    <p role="status">{t("Opening your destination…")}</p>
  </main>;
}
