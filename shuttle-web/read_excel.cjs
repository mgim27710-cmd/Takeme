const XLSX = require('xlsx');
const path = require('path');

try {
  const filePath = path.join(__dirname, 'public/전년도_자료_입력_시트_양식.xlsx');
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log("HEADERS:", json[0]);
  console.log("FIRST ROW:", json[1]);
} catch(e) {
  console.error("ERROR:", e);
}
