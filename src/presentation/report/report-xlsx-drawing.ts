export type ReportXlsxImage={dispW:number;dispH:number;row0:number};

export function createReportXlsxDrawing(toEmu:(pixels:number)=>number){
  return(images:ReportXlsxImage[])=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'+images.map((image,index)=>{
    const cx=toEmu(image.dispW),cy=toEmu(image.dispH);
    return '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+image.row0+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="'+cx+'" cy="'+cy+'"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+(index+1)+'" name="Chart'+(index+1)+'"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId'+(index+1)+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>';
  }).join('')+'</xdr:wsDr>';
}
