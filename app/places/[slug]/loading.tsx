import Link from "next/link";
import styles from "../../guide.module.css";

export default function DestinationLoading() {
  return <main className={styles.routeLoading} aria-busy="true">
    <Link href="/">← Back to Explore</Link>
    <p role="status">Opening your destination…</p>
    <div className={styles.loadingSpread} aria-hidden="true"><span /><span /></div>
  </main>;
}
