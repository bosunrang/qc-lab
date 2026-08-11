export type ReportXlsxCell={v:unknown;s:number;num?:boolean};
export type ReportXlsxDocument={cols:number[];rows:ReportXlsxCell[][];rowHeights?:Record<number,number>;merges?:string[];hasDrawing?:boolean};

export function createReportXlsxSheet(deps:{columns:string[];text:(ref:string,style:number,value:unknown)=>string;number:(ref:string,style:number,value:unknown)=>string}){
  return(doc:ReportXlsxDocument)=>{
    const colsXml='<cols>'+doc.cols.map((width,index)=>'<col min="'+(index+1)+'" max="'+(index+1)+'" width="'+width+'" customWidth="1"/>').join('')+'</cols>';
    const body=doc.rows.map((cells,rowIndex)=>{const row=rowIndex+1,height=doc.rowHeights&&doc.rowHeights[row];const values=(cells||[]).map((cell,columnIndex)=>{if(!cell)return '';const ref=deps.columns[columnIndex]+row;return cell.num?deps.number(ref,cell.s,cell.v):deps.text(ref,cell.s,cell.v);}).join('');return '<row r="'+row+'"'+(height?' ht="'+height+'" customHeight="1"':'')+'>'+values+'</row>';}).join('');
    const lastRow=doc.rows.length||1,lastCol=deps.columns[doc.cols.length-1],merges=doc.merges||[],mergeXml=merges.length?'<mergeCells count="'+merges.length+'">'+merges.map(merge=>'<mergeCell ref="'+merge+'"/>').join('')+'</mergeCells>':'';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:'+lastCol+lastRow+'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>'+colsXml+'<sheetData>'+body+'</sheetData>'+mergeXml+'<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>'+(doc.hasDrawing?'<drawing r:id="rId1"/>':'')+'</worksheet>';
  };
}
