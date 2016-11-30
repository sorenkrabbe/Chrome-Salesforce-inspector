/* exported csvParse */
"use strict";
function csvParse(csv, separator) {
  let table = [];
  let row = [];
  let offset = 0;
  for (;;) {
    let text, next;
    if (offset != csv.length && csv[offset] == "\"") {
      next = csv.indexOf("\"", offset + 1);
      text = "";
      for (;;) {
        if (next == -1) {
          throw {message: "Quote not closed", offsetStart: offset, offsetEnd: offset + 1};
        }
        text += csv.substring(offset + 1, next);
        offset = next + 1;
        if (offset == csv.length || csv[offset] != "\"") {
          break;
        }
        text += "\"";
        next = csv.indexOf("\"", offset + 1);
      }
    } else {
      next = csv.length;
      let i = csv.indexOf(separator, offset);
      if (i != -1 && i < next) {
        next = i;
      }
      i = csv.indexOf("\n", offset);
      if (i != -1 && i < next) {
        if (i > offset && csv[i - 1] == "\r") {
          next = i - 1;
        } else {
          next = i;
        }
      }
      text = csv.substring(offset, next);
      offset = next;
    }
    row.push(text);
    if (offset == csv.length) {
      if (row.length != 1 || row[0] != "") {
        table.push(row);
      }
      if (table.length == 0) {
        throw {message: "no data", offsetStart: 0, offsetEnd: csv.length};
      }
      let len = table[0].length;
      for (let i = 0; i < table.length; i++) {
        if (table[i].length != len) {
          throw {
            message: "row " + (i + 1) + " has " + table[i].length + " cells, expected " + len,
            offsetStart: csv.split("\n").slice(0, i).join("\n").length + 1,
            offsetEnd: csv.split("\n").slice(0, i + 1).join("\n").length
          };
        }
      }
      return table;
    } else if (csv[offset] == "\n") {
      offset++;
      table.push(row);
      row = [];
    } else if (csv[offset] == "\r" && offset + 1 < csv.length && csv[offset + 1] == "\n") {
      offset += 2;
      table.push(row);
      row = [];
    } else if (csv[offset] == separator) {
      offset++;
    } else {
      throw {message: "unexpected token '" + csv[offset] + "'", offsetStart: offset, offsetEnd: offset + 1};
    }
  }
}
