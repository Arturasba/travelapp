"use client";
import { useLocale } from "../locale-context";
import { translator } from "../i18n";
import styles from "../guide.module.css";
export default function NotFound(){const locale=useLocale();const t=translator(locale);return <main className={styles.routeLoading}><h1>404</h1><p>{t("This place could not be found.")}</p><a href={`/${locale}`}>{t("Return to the map")}</a></main>;}
