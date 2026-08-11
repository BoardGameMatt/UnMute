import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { TraneReportPayload } from "@/lib/trane-quiz/report-data";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111111",
  },
  header: {
    backgroundColor: "#32007E",
    paddingVertical: 18,
    paddingHorizontal: 28,
  },
  headerEyebrow: {
    color: "#FFFFFF",
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 4,
  },
  headerMeta: {
    color: "#DDDDFF",
    fontSize: 9,
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  summaryChip: {
    borderWidth: 1,
    borderColor: "#EEEEEE",
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 70,
  },
  chipLabel: {
    fontSize: 7,
    color: "#32007E",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chipValue: {
    fontSize: 14,
    color: "#6400FF",
    marginTop: 2,
  },
  deltaBlock: {
    marginBottom: 18,
    padding: 12,
    backgroundColor: "#F7F4FF",
    borderRadius: 4,
  },
  deltaTitle: {
    fontSize: 11,
    color: "#6400FF",
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#32007E",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: {
    color: "#FFFFFF",
    fontSize: 7,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  cell: {
    fontSize: 8,
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },
  footerText: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 4,
  },
  logo: {
    width: 90,
    height: 36,
    objectFit: "contain",
    marginTop: 8,
    alignSelf: "flex-end",
  },
  colNum: { width: "6%" },
  colStem: { width: "52%" },
  colPre: { width: "14%" },
  colPost: { width: "14%" },
  colDelta: { width: "14%" },
});

function fmt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
}

function fmtDelta(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} pp`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

type TraneReportDocumentProps = {
  payload: TraneReportPayload;
  logoSrc: string;
};

export function TraneReportDocument({
  payload,
  logoSrc,
}: TraneReportDocumentProps) {
  const { summary } = payload;
  const designation = payload.label
    ? `${payload.courseTitle} · ${payload.classDate} · ${payload.label}`
    : `${payload.courseTitle} · ${payload.classDate}`;

  return (
    <Document
      title={`Trane PM Knowledge Check — ${payload.courseTitle}`}
      author="Unmute Labs"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>
            Product Management Training — Knowledge Check
          </Text>
          <Text style={styles.headerTitle}>{designation}</Text>
          <Text style={styles.headerMeta}>
            Generated {new Date(payload.generatedAt).toLocaleString("en-US")}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.summaryRow}>
            {(
              [
                ["Joined", summary.joined],
                ["Beginning", summary.preCompleted],
                ["End", summary.postCompleted],
                ["Paired", summary.paired],
                ["End only", summary.endOnly],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={styles.summaryChip}>
                <Text style={styles.chipLabel}>{label}</Text>
                <Text style={styles.chipValue}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.deltaBlock}>
            <Text style={styles.deltaTitle}>Paired learning delta</Text>
            <Text>
              Before {fmt(summary.meanPrePercent)} → After{" "}
              {fmt(summary.meanPostPercent)} ({fmtDelta(summary.deltaPp)})
            </Text>
            {summary.endOnly > 0 ? (
              <Text style={{ marginTop: 6, fontSize: 8, color: "#666666" }}>
                {summary.endOnly} people completed the end quiz only (no
                beginning quiz on this phone). Excluded from paired delta.
              </Text>
            ) : null}
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colNum]}>#</Text>
            <Text style={[styles.th, styles.colStem]}>Question</Text>
            <Text style={[styles.th, styles.colPre]}>Before</Text>
            <Text style={[styles.th, styles.colPost]}>After</Text>
            <Text style={[styles.th, styles.colDelta]}>Change</Text>
          </View>

          {summary.byQuestion.map((row) => (
            <View key={row.questionId} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colNum]}>{row.sortOrder}</Text>
              <Text style={[styles.cell, styles.colStem]}>
                {truncate(row.stem, 90)}
              </Text>
              <Text style={[styles.cell, styles.colPre]}>
                {fmt(row.prePercent)}
              </Text>
              <Text style={[styles.cell, styles.colPost]}>
                {fmt(row.postPercent)}
              </Text>
              <Text style={[styles.cell, styles.colDelta]}>
                {fmtDelta(row.deltaPp)}
              </Text>
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Anonymous responses. Same-device pairing when available. No
              individual scores.
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
            <Image src={logoSrc} style={styles.logo} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
