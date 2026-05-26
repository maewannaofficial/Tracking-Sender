import { google, type sheets_v4 } from "googleapis";

import { buildTrackingMessage } from "@/lib/message";
import type {
  MatchStatus,
  OrderStatusFilter,
  SendStatus,
  TrackingOrder,
} from "@/types/order";

export const SHEET_HEADERS = [
  "id",
  "fb_name",
  "tracking_no",
  "customer_name",
  "cod_amount",
  "message",
  "subscriber_id",
  "status",
  "match_status",
  "send_status",
  "sent_at",
  "error",
] as const;

export type SheetHeader = (typeof SHEET_HEADERS)[number];

const headerAliases: Record<SheetHeader, string[]> = {
  id: ["id", "ID"],
  fb_name: ["fb_name", "FB Name", "ชื่อ FB", "ชื่อเฟส", "ชื่อ Facebook", "Name"],
  tracking_no: ["tracking_no", "Tracking No", "เลขพัสดุ"],
  customer_name: ["customer_name", "Customer Name", "Name", "ชื่อลูกค้า", "ชื่อผู้รับ"],
  cod_amount: ["cod_amount", "COD", "ยอดปลายทาง", "ยอดปลายทาง (ถ้ามี)", "ยอดชำระปลายทาง"],
  message: ["message", "Message", "Summary", "สรุป", "ข้อความ", "ข้อความที่ต้องส่ง"],
  subscriber_id: ["conversation_id", "Conversation ID", "conversationId", "subscriber_id", "Subscriber ID", "PSID"],
  status: ["Status", "status"],
  match_status: ["match_status", "Match Status"],
  send_status: ["send_status", "Send Status"],
  sent_at: ["sent_at", "Sent At"],
  error: ["error", "Error"],
};

const writableHeaderLabels: Partial<Record<SheetHeader, string>> = {
  subscriber_id: "conversation_id",
  status: "Status",
  match_status: "match_status",
  send_status: "send_status",
  sent_at: "sent_at",
  error: "error",
};

const defaultWritableHeaders: SheetHeader[] = [
  "subscriber_id",
  "status",
  "match_status",
  "send_status",
  "sent_at",
  "error",
];

const matchStatuses = new Set<MatchStatus>([
  "pending",
  "matched",
  "multiple_matches",
  "not_found",
  "error",
]);

const sendStatuses = new Set<SendStatus>(["pending", "sent", "failed", "skipped"]);

let sheetsClient: sheets_v4.Sheets | null = null;
let resolvedSheetName: string | null = null;

function getEnv(name: string) {
  const value = normalizeEnvValue(process.env[name] ?? "");
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  return (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ? trimmed.slice(1, -1)
    : trimmed;
}

export function extractGoogleSheetId(value: string) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([^/?#]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return trimmed.split("/edit")[0].split("?")[0].split("#")[0].trim();
}

export function extractGoogleSheetGid(value: string) {
  const match = value.match(/[?&#]gid=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function normalizePrivateKey(value: string) {
  return normalizeEnvValue(value).replace(/\\n/g, "\n");
}

function getSpreadsheetId() {
  return extractGoogleSheetId(getEnv("GOOGLE_SHEET_ID"));
}

export function formatSheetRange(sheetName: string, range: string) {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  const needsQuotes = /[^A-Za-z0-9_]/.test(escapedSheetName);
  return `${needsQuotes ? `'${escapedSheetName}'` : escapedSheetName}!${range}`;
}

async function getConfiguredSheetName() {
  if (resolvedSheetName) {
    return resolvedSheetName;
  }

  const sheetIdValue = getEnv("GOOGLE_SHEET_ID");
  const gid = extractGoogleSheetGid(sheetIdValue);

  if (gid !== null) {
    const response = await getSheetsClient().spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: "sheets(properties(title,sheetId))",
    });
    const matchingSheet = response.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid);
    const title = matchingSheet?.properties?.title;
    if (title) {
      resolvedSheetName = title;
      return resolvedSheetName;
    }
  }

  resolvedSheetName = (process.env.GOOGLE_SHEET_NAME ?? "tracking_messages").trim();
  return resolvedSheetName;
}

async function getSheetProperties(sheetName: string) {
  const response = await getSheetsClient().spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets(properties(title,sheetId,gridProperties(columnCount)))",
  });
  const matchingSheet = response.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);
  const properties = matchingSheet?.properties;
  if (!properties?.sheetId) {
    throw new Error(`Sheet ${sheetName} not found`);
  }

  return {
    sheetId: properties.sheetId,
    columnCount: properties.gridProperties?.columnCount ?? 0,
  };
}

async function ensureSheetColumnCount(sheetName: string, minimumColumnCount: number) {
  const { sheetId, columnCount } = await getSheetProperties(sheetName);
  if (columnCount >= minimumColumnCount) {
    return;
  }

  await getSheetsClient().spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                columnCount: minimumColumnCount,
              },
            },
            fields: "gridProperties.columnCount",
          },
        },
      ],
    },
  });
}

function getSheetsClient() {
  if (!sheetsClient) {
    const auth = new google.auth.JWT({
      email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      key: normalizePrivateKey(getEnv("GOOGLE_PRIVATE_KEY")),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClient = google.sheets({ version: "v4", auth });
  }

  return sheetsClient;
}

function normalizeStatus<T extends string>(value: string | undefined, fallback: T, allowed: Set<T>) {
  const normalized = value?.trim() as T | undefined;
  return normalized && allowed.has(normalized) ? normalized : fallback;
}

function parseCodAmount(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractCustomerNameFromMessage(message: string) {
  const match = message.match(/(?:ชื่อผู้รับ|ชื่อ)[ \t]*[:：][ \t]*([^\n\r]*)/);
  return match?.[1]?.trim() ?? "";
}

function extractCodAmountFromMessage(message: string) {
  const match = message.match(/ยอด(?:ชำระ)?ปลายทาง\s*[:：]\s*([0-9,]+)/);
  return match ? parseCodAmount(match[1]) : 0;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function buildHeaderIndex(headerRow: string[]) {
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));
  const index = new Map<string, number>();

  for (const header of SHEET_HEADERS) {
    const aliases = headerAliases[header].map(normalizeHeader);
    const foundIndex = normalizedHeaders.findIndex((value) => aliases.includes(value));
    if (foundIndex !== -1) {
      index.set(header, foundIndex);
    }
  }

  if (!index.has("message") && index.has("fb_name")) {
    const fbIndex = index.get("fb_name")!;
    const codIndex = index.get("cod_amount");
    index.set("message", codIndex !== undefined ? codIndex + 1 : fbIndex + 1);
  }

  return index;
}

export function buildWritableHeaderPlan(headerRow: string[], requestedHeaders: SheetHeader[]) {
  const headerIndex = buildHeaderIndex(headerRow);
  const nextHeaderRow = [...headerRow];
  const headerWrites: { header: SheetHeader; index: number; label: string }[] = [];

  for (const header of requestedHeaders) {
    if (headerIndex.has(header)) {
      continue;
    }

    const label = writableHeaderLabels[header];
    if (!label) {
      continue;
    }

    const index = nextHeaderRow.length;
    nextHeaderRow.push(label);
    headerIndex.set(header, index);
    headerWrites.push({ header, index, label });
  }

  return { headerIndex, headerWrites };
}

function cell(row: string[], headerIndex: Map<string, number>, header: SheetHeader) {
  const index = headerIndex.get(header);
  return index === undefined ? "" : String(row[index] ?? "").trim();
}

export function normalizeSheetRows(values: string[][] = []): TrackingOrder[] {
  if (values.length === 0) {
    return [];
  }

  const headerIndex = buildHeaderIndex(values[0]);

  return values.slice(1).flatMap((row, index) => {
    const rowNumber = index + 2;
    const id = cell(row, headerIndex, "id") || String(rowNumber);
    const sheetMessage = cell(row, headerIndex, "message");
    const messageName = extractCustomerNameFromMessage(sheetMessage);
    const fb_name = cell(row, headerIndex, "fb_name") || messageName;
    const tracking_no = cell(row, headerIndex, "tracking_no");
    const customer_name = cell(row, headerIndex, "customer_name") || fb_name;
    const cod_amount =
      parseCodAmount(cell(row, headerIndex, "cod_amount")) || extractCodAmountFromMessage(sheetMessage);

    if (!fb_name && !tracking_no && !customer_name && !sheetMessage) {
      return [];
    }

    return [
      {
        rowNumber,
        id,
        fb_name,
        tracking_no,
        customer_name,
        cod_amount,
        message:
          sheetMessage ||
          buildTrackingMessage({
            customer_name,
            tracking_no,
            cod_amount,
          }),
        subscriber_id: cell(row, headerIndex, "subscriber_id"),
        match_status: normalizeStatus(
          cell(row, headerIndex, "match_status"),
          "pending",
          matchStatuses,
        ),
        send_status: normalizeStatus(cell(row, headerIndex, "send_status"), "pending", sendStatuses),
        sent_at: cell(row, headerIndex, "sent_at"),
        error: cell(row, headerIndex, "error"),
      },
    ];
  });
}

export function filterOrdersByStatus(orders: TrackingOrder[], status?: OrderStatusFilter | string | null) {
  if (!status) {
    return orders.filter((order) => order.send_status === "pending" || order.send_status === "failed");
  }

  if (status === "all") {
    return orders;
  }

  return orders.filter((order) => order.send_status === status || order.match_status === status);
}

export async function getOrders(status?: OrderStatusFilter | string | null) {
  const sheetName = await getConfiguredSheetName();
  const response = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: formatSheetRange(sheetName, "A:Z"),
  });
  const values = (response.data.values ?? []) as string[][];
  await ensureWritableHeaders(sheetName, values[0] ?? [], defaultWritableHeaders);

  return filterOrdersByStatus(normalizeSheetRows(values), status);
}

export async function getOrderByRowNumber(rowNumber: number) {
  const orders = await getOrders("all");
  return orders.find((order) => order.rowNumber === rowNumber) ?? null;
}

function columnName(index: number) {
  let column = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - remainder - 1) / 26);
  }

  return column;
}

async function ensureWritableHeaders(sheetName: string, headerRow: string[], requestedHeaders: SheetHeader[]) {
  if (headerRow.length === 0) {
    return;
  }

  const { headerWrites } = buildWritableHeaderPlan(headerRow, requestedHeaders);
  if (headerWrites.length === 0) {
    return;
  }
  await ensureSheetColumnCount(sheetName, Math.max(...headerWrites.map((write) => write.index + 1)));

  await getSheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: headerWrites.map(({ index, label }) => {
        const column = columnName(index);
        return {
          range: formatSheetRange(sheetName, `${column}1`),
          values: [[label]],
        };
      }),
    },
  });
}

export async function updateOrderCells(rowNumber: number, patch: Partial<Record<SheetHeader, string | number>>) {
  const sheetName = await getConfiguredSheetName();
  const headerResponse = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: formatSheetRange(sheetName, "A1:Z1"),
  });
  const headerRow = ((headerResponse.data.values ?? [[]]) as string[][])[0] ?? [];
  const requestedHeaders = Object.keys(patch).filter((header): header is SheetHeader =>
    (SHEET_HEADERS as readonly string[]).includes(header),
  );
  const { headerIndex, headerWrites } = buildWritableHeaderPlan(headerRow, requestedHeaders);
  if (headerWrites.length > 0) {
    await ensureSheetColumnCount(sheetName, Math.max(...headerWrites.map((write) => write.index + 1)));
  }
  const data = [
    ...headerWrites.map(({ index, label }) => {
      const column = columnName(index);
      return {
        range: formatSheetRange(sheetName, `${column}1`),
        values: [[label]],
      };
    }),
    ...Object.entries(patch).flatMap(([header, value]) => {
      const index = headerIndex.get(header);
      if (index === undefined) {
        return [];
      }

      const column = columnName(index);
      return [
        {
          range: formatSheetRange(sheetName, `${column}${rowNumber}`),
          values: [[String(value ?? "")]],
        },
      ];
    }),
  ];

  if (data.length === 0) {
    return;
  }

  await getSheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}
