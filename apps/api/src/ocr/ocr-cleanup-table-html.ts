import * as cheerio from "cheerio";

function normalizeTableCellText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function convertOcrTableHtmlToTsv(content: string): string {
  if (!/<table[\s>]/i.test(content)) {
    return content;
  }

  const $ = cheerio.load(content, {}, false);
  $("table img").remove();

  const rows = $("table")
    .toArray()
    .flatMap((table) =>
      $(table)
        .find("tr")
        .toArray()
        .map((row) =>
          $(row)
            .children("th, td")
            .toArray()
            .map((cell) => normalizeTableCellText($(cell).text())),
        )
        .filter((cells) => cells.length > 0),
    );

  if (rows.length === 0) {
    return content;
  }

  return rows.map((cells) => cells.join("\t")).join("\n");
}
