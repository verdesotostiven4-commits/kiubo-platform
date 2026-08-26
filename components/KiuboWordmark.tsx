export function KiuboWordmark({className=""}:{className?:string}){
  return <span className={`kiubo-wordmark ${className}`.trim()} aria-label="KIUBO"><span className="kiubo-wordmark-kiu">KIU</span><span className="kiubo-wordmark-b">B</span><span className="kiubo-wordmark-o">O</span></span>;
}
