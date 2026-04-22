import * as XLSX from 'xlsx';
import { collection, getDocs, Firestore } from 'firebase/firestore';
import { format } from 'date-fns';

export const collectionsToExport = [
  'products',
  'productMaster',
  'categories',
  'suppliers',
  'customers',
  'sales',
  'purchases',
  'expenses'
];

export const exportAllToExcel = async (db: Firestore) => {
  try {
    const wb = XLSX.utils.book_new();

    for (const colName of collectionsToExport) {
      const snapshot = await getDocs(collection(db, colName));
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        const cleanedData: any = { id: doc.id };
        Object.keys(docData).forEach(key => {
          const val = docData[key];
          if (val && typeof val === 'object' && val.toDate) {
            cleanedData[key] = format(val.toDate(), 'yyyy-MM-dd HH:mm:ss');
          } else if (Array.isArray(val)) {
            cleanedData[key] = JSON.stringify(val);
          } else {
            cleanedData[key] = val;
          }
        });
        return cleanedData;
      });

      if (data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, colName);
      } else {
        const ws = XLSX.utils.aoa_to_sheet([['No Data Found in ' + colName]]);
        XLSX.utils.book_append_sheet(wb, ws, colName);
      }
    }

    XLSX.writeFile(wb, `freshpos_data_full_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    return true;
  } catch (err) {
    console.error('Master Export failed:', err);
    throw err;
  }
};
