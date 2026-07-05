function parseRFC4180(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          cur += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false; // End quote
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(cur);
        cur = '';
        if (row.length > 1 || row[0] !== '') {
          rows.push(row);
        }
        row = [];
        if (c === '\r') i++; // Skip \n
      } else if (c === '\r') {
        row.push(cur);
        cur = '';
        if (row.length > 1 || row[0] !== '') {
          rows.push(row);
        }
        row = [];
      } else {
        cur += c;
      }
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
  }
  
  if (rows.length === 0) return [];
  
  const headers = rows[0].map(h => h.trim());
  const objects = [];
  
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = r[idx];
      if (val === undefined || val === null) {
        val = null;
      } else {
        val = val.trim();
        if (val === '' || val === 'NULL' || val === '\\N') {
          val = null;
        } else if (val === 'true') {
          val = true;
        } else if (val === 'false') {
          val = false;
        } else if (val.startsWith('{') || val.startsWith('[')) {
          try { val = JSON.parse(val); } catch(e) {}
        }
      }
      obj[h] = val;
    });
    objects.push(obj);
  }
  return objects;
}

module.exports = { parseRFC4180 };
