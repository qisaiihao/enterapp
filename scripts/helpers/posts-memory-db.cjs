const clone = value => structuredClone(value);
const field = (value, key) => key.split('.').reduce((row, part) => Array.isArray(row) ? row.map(item => item && item[part]) : row && row[part], value);
function literal(value) {
  if (value && value.operator && Array.isArray(value.operands)) {
    const op = value.operator === 'neq' ? 'ne' : value.operator;
    return { ['$' + op]: literal(['and', 'or', 'nor', 'in', 'nin', 'all'].includes(op) ? value.operands : value.operands[0]) };
  }
  if (Array.isArray(value)) return value.map(literal);
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,literal(v)]));
  return value;
}
function expr(value, row, vars = {}) {
  if (typeof value === 'string' && value.startsWith('$$')) return vars[value.slice(2)];
  if (typeof value === 'string' && value.startsWith('$')) return field(row, value.slice(1));
  if (Array.isArray(value)) return value.map(item => expr(item,row,vars));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const [op, args] = Object.entries(value)[0] || [];
  const values = Array.isArray(args) ? args.map(item => expr(item,row,vars)) : [];
  if (op === '$ifNull') return values[0] == null ? values[1] : values[0];
  if (op === '$add') {
    const total = values.reduce((sum, item) => sum + Number(item), 0);
    return values.some(item => item instanceof Date) ? new Date(total) : total;
  }
  if (op === '$eq') return values[0] === values[1];
  if (op === '$ne') return values[0] !== values[1];
  if (op === '$and') return values.every(Boolean);
  if (op === '$or') return values.some(Boolean);
  if (op === '$cond') return values[0] ? values[1] : values[2];
  if (op === '$arrayElemAt') return (values[0] || [])[values[1]];
  if (op === '$size') return expr(args,row,vars).length;
  throw Error('Unsupported test expression: ' + JSON.stringify(value));
}
function matches(row, input, vars = {}) {
  const query = literal(input);
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$and') return expected.every(item => matches(row,item,vars));
    if (key === '$or') return expected.some(item => matches(row,item,vars));
    if (key === '$nor') return !expected.some(item => matches(row,item,vars));
    if (key === '$expr') return expr(expected,row,vars);
    const actual = field(row,key);
    if (expected instanceof Date) return +actual === +expected;
    if (!expected || typeof expected !== 'object') return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
    return Object.entries(expected).every(([op,value]) => {
      if (op === '$regex') return typeof actual === 'string' && new RegExp(value, expected.$options || '').test(actual);
      if (op === '$options') return true;
      if (op === '$eq') return actual === value;
      if (op === '$ne') return actual !== value;
      if (op === '$exists') return (actual !== undefined) === value;
      if (op === '$in') return value.includes(actual);
      if (op === '$nin') return !value.includes(actual);
      if (op === '$gt') return actual > value;
      if (op === '$gte') return actual >= value;
      if (op === '$lt') return actual < value;
      if (op === '$lte') return actual <= value;
      throw Error('Unsupported test predicate: ' + op);
    });
  });
}
function project(row, fields) {
  if (!Object.values(fields).some(v => v !== false && v !== 0)) {
    const out={...row}; for (const key of Object.keys(fields)) delete out[key]; return out;
  }
  const out = {};
  if (fields._id !== false && fields._id !== 0 && row._id) out._id=row._id;
  for (const [key,value] of Object.entries(fields)) {
    if (value === true || value === 1) { if(row[key] !== undefined)out[key]=row[key]; }
    else if (value !== false && value !== 0) out[key]=expr(value,row);
  }
  return out;
}
function memoryDb(initial, command, options = {}) {
  const tables = clone(initial), calls = [];
  let sequence=0;
  const db={command, RegExp:({regexp,options=''})=>({$regex:regexp,$options:options}), serverDate:()=>new Date(), collection(name) {
    tables[name] ||= [];
    function query(state={}) {
      const selected=()=>tables[name].filter(row=>matches(row,state.filter || {})).slice().sort((a,b)=> {
        for(const [key,order] of state.sort || []){if(a[key]!==b[key])return (a[key]>b[key]?1:-1)*(order==='desc'?-1:1);} return 0;
      }).slice(state.skip || 0,(state.skip || 0)+(state.limit || Infinity));
      const q={
        where(filter){return query({...state,filter});},
        doc(id){return query({...state,id,filter:{_id:id}});},
        orderBy(key,order){return query({...state,sort:[...(state.sort||[]),[key,order]]});},
        limit(limit){return query({...state,limit});}, skip(skip){return query({...state,skip});}, field(fields){return query({...state,fields});},
        async get(){calls.push({name,op:'get'});const rows=selected().map(row=>state.fields?project(row,state.fields):clone(row));return {data:state.id?(rows[0]||null):rows};},
        async count(){calls.push({name,op:'count'});return {total:selected().length};},
        async add({data}){options.beforeWrite?.({name,op:'add',data});calls.push({name,op:'add'});const _id='new-'+(++sequence);tables[name].push({...clone(data),_id});return {_id};},
        async set({data}){options.beforeWrite?.({name,op:'set',data});calls.push({name,op:'set'});if(!state.id)throw Error('set requires document id');const index=tables[name].findIndex(row=>row._id===state.id);const row={...clone(data),_id:state.id};if(index<0)tables[name].push(row);else tables[name][index]=row;return {_id:state.id};},
        async update({data}){options.beforeWrite?.({name,op:'update',data});calls.push({name,op:'update'});const rows=selected();for(const row of rows)for(const [key,value]of Object.entries(data)){
          if(value && value.operator==='remove')delete row[key];else if(value && value.operator==='inc')row[key]=(row[key]||0)+value.operands[0];else row[key]=clone(value);
        }return {stats:{updated:rows.length}};},
        async remove(){const rows=selected();tables[name]=tables[name].filter(row=>!rows.includes(row));return {stats:{removed:rows.length}};},
        aggregate(){return aggregate([]);}
      };
      return q;
    }
    function aggregate(stages){
      const a={async end(){calls.push({name,op:'aggregate',stages});let rows=clone(tables[name]);for(const [op,value]of stages){
        if(op==='match')rows=rows.filter(row=>matches(row,value));
        else if(op==='skip')rows=rows.slice(value);
        else if(op==='limit')rows=rows.slice(0,value);
        else if(op==='sort')rows.sort((a,b)=>{for(const [key,direction]of Object.entries(value)){const left=a[key] instanceof Date?+a[key]:a[key],right=b[key] instanceof Date?+b[key]:b[key];if(left!==right)return (left>right?1:-1)*direction;}return 0;});
        else if(op==='addFields')rows=rows.map(row=>({...row,...Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expr(v,row)]))}));
        else if(op==='project')rows=rows.map(row=>project(row,value));
        else if(op==='count')rows=[{[value]:rows.length}];
        else throw Error('Unsupported memory stage: '+op);
      }return {list:rows};}};
      for(const key of ['match','sort','skip','limit','project','addFields','count'])a[key]=value=>aggregate([...stages,[key,value]]);
      return a;
    }
    return query();
  }};
  // Serialize commits like conflicting production transactions. A failed callback
  // restores every table, so tests can prove no content or counters leak on failure.
  let transactionTail = Promise.resolve();
  db.runTransaction = callback => {
    const result = transactionTail.then(async () => {
      const saved = clone(tables), savedSequence = sequence;
      try { return await callback(db); }
      catch (error) {
        for (const key of Object.keys(tables)) delete tables[key];
        Object.assign(tables, saved); sequence = savedSequence;
        throw error;
      }
    });
    transactionTail = result.catch(() => {});
    return result;
  };
  return {db,tables,calls};
}
module.exports={matches,expr,literal,memoryDb};
