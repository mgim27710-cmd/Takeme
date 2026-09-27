import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const files = ['전년도_자료_입력_시트_양식.xlsx', '학원생_정보_입력_시트.xlsx'];

files.forEach(fileName => {
  try {
    const filePath = path.join(publicDir, fileName);
    if (fs.existsSync(filePath)) {
      const wb = XLSX.readFile(filePath);
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = json[0];
      // Find where '주소' is and add '등원지', '하원지' next to it
      const addressIdx = headers.indexOf('주소');
      
      if (addressIdx !== -1 && !headers.includes('등원지')) {
        headers.splice(addressIdx + 1, 0, '등원지', '하원지');
        
        // Update all rows
        for (let i = 1; i < json.length; i++) {
          if (json[i].length > 0) {
            json[i].splice(addressIdx + 1, 0, '', '');
          }
        }
        
        const newSheet = XLSX.utils.aoa_to_sheet(json);
        wb.Sheets[sheetName] = newSheet;
        XLSX.writeFile(wb, filePath);
        console.log(`Updated ${fileName} successfully.`);
      } else {
        console.log(`${fileName} already updated or '주소' not found.`);
      }
    }
  } catch (err) {
    console.error(`Failed to update ${fileName}:`, err);
  }
});
