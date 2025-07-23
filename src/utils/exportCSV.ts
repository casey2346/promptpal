// src/utils/exportCSV.ts

import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";

export async function exportScoresCSV(data: Record<string, any>[], filepath: string) {
  if (data.length === 0) {
    throw new Error("No data to export.");
  }

  const headers = Object.keys(data[0]).map((key) => ({ id: key, title: key }));

  const writer = createObjectCsvWriter({
    path: filepath,
    header: headers,
  });

  await writer.writeRecords(data);
}
