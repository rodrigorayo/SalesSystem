import { useState, useEffect, useCallback } from "react";
import { getSalesPercentiles } from "../api/api";
import { Loader2, AlertTriangle, Store, BarChart2, ChevronLeft, ChevronRight, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx"; import { twMerge } from "tailwind-merge";
function cn(...i: any[]) { return twMerge(clsx(i)); }
const fmt  = (n: number) => `Bs. ${n.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const ZONES = {
  critico:{ label:"Critico", color:"text-red-700",    bg:"bg-red-100",    border:"border-red-300",    dot:"bg-red-500",    pill:"bg-red-500 text-white"    },
  bajo:   { label:"Bajo",    color:"text-amber-700",  bg:"bg-amber-100",  border:"border-amber-300",  dot:"bg-amber-400",  pill:"bg-amber-400 text-white"  },
  normal: { label:"Normal",  color:"text-emerald-700",bg:"bg-emerald-100",border:"border-emerald-300",dot:"bg-emerald-500",pill:"bg-emerald-500 text-white" },
  alto:   { label:"Alto",    color:"text-violet-700", bg:"bg-violet-100", border:"border-violet-300", dot:"bg-violet-500", pill:"bg-violet-500 text-white"  },
} as const;
const SUCS = [
  {value:"",label:"Todas las Sucursales"},{value:"Heroinas",label:"Heroínas"},
  {value:"Recoleta",label:"Recoleta"},
  {value:"Calacoto",label:"Calacoto"},
];
const DAYS  = ["Lun","Mar","Mie","Jue","Vie","Sab","Dom"];
const MES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function getMonday(d:Date){ const c=new Date(d),day=c.getDay(); c.setDate(c.getDate()-(day===0?6:day-1)); c.setHours(0,0,0,0); return c; }
function iso(d:Date){ return d.toISOString().slice(0,10); }

function Tooltip({entry,p25,p50,p75}:{entry:any,p25:number,p50:number,p75:number}){
  if(!entry) return null;
  const isFut = entry.is_future;
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none hidden group-hover:flex flex-col">
      <div className="bg-gray-900/95 text-white text-[10px] rounded-2xl px-3 py-2.5 shadow-2xl min-w-[160px]">
        <p className="text-gray-400 text-[9px] uppercase tracking-widest mb-1.5">{entry.fecha}</p>
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-gray-400">{isFut?"Referencia historica":"Venta real"}</span>
          <span className="font-black">{fmt(entry.total)}</span>
        </div>
        <div className="h-px bg-white/10 my-1.5"/>
        <div className="flex justify-between gap-4 mb-0.5">
          <span className="text-red-400 flex items-center gap-1"><TrendingDown size={8}/>Min (P25)</span>
          <span className="font-black text-red-300">{fmt(isFut?(entry.total_low??p25):p25)}</span>
        </div>
        <div className="flex justify-between gap-4 mb-0.5">
          <span className="text-amber-400 flex items-center gap-1"><Minus size={8}/>Med (P50)</span>
          <span className="font-black text-amber-300">{fmt(p50)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-violet-400 flex items-center gap-1"><TrendingUp size={8}/>Max (P75)</span>
          <span className="font-black text-violet-300">{fmt(isFut?(entry.total_high??p75):p75)}</span>
        </div>
        {!isFut&&entry.pct_vs_p50!==0&&(
          <div className={cn("mt-1.5 font-black text-[9px]",entry.pct_vs_p50>=0?"text-emerald-400":"text-red-400")}>
            {entry.pct_vs_p50>0?"+":""}{entry.pct_vs_p50}% vs mediana
          </div>
        )}
      </div>
      <div className="w-2.5 h-2.5 bg-gray-900/95 rotate-45 -mt-1.5 self-center"/>
    </div>
  );
}

export default function SalesPercentileTracker(){
  const [sucursal,setSucursal]=useState("");
  const [data,setData]=useState<any>(null);
  const [isLoading,setIsLoading]=useState(true);
  const [isError,setIsError]=useState(false);
  const [view,setView]=useState<"month"|"week">("month");
  const now=new Date();
  const [navYear,setNavYear]=useState(now.getFullYear());
  const [navMonth,setNavMonth]=useState(now.getMonth());
  const [weekOffset,setWeekOffset]=useState(0);
  const weekStart=(()=>{ const d=getMonday(new Date()); d.setDate(d.getDate()+weekOffset*7); return d; })();

  const fetchData=useCallback(async(suc:string)=>{
    setIsLoading(true);
    setIsError(false);
    try { 
      const res = await getSalesPercentiles(suc||undefined,365,"day"); 
      setData(res);
    } catch(err) { 
      setIsError(true); 
    } finally { 
      setIsLoading(false); 
    }
  },[]);
  useEffect(()=>{ fetchData(sucursal); },[sucursal,fetchData]);

  const byDate:Record<string,any>={};
  if(data?.periods){ for(const p of data.periods) byDate[p.fecha]=p; }

  const p    = data?.percentiles;
  const lastR= data?.last_real;
  const lastZ= lastR?(ZONES[lastR.zone as keyof typeof ZONES]??ZONES.normal):null;
  const p50  = p?.p50??0; const p25=p?.p25??0; const p75=p?.p75??0;

  const histPeriods = data?.periods ? data.periods.filter((x: any) => !x.is_future) : [];
  const totalSalesHist = histPeriods.reduce((acc: number, curr: any) => acc + curr.total, 0);

  // Sparkline calculations
  const last7Days = histPeriods.slice(-7);
  const maxLast7 = last7Days.length > 0 ? Math.max(...last7Days.map((d: any) => d.total), 1) : 1;
  const maxP = p75 || 1;
  const p25Pct = (p25 / maxP) * 100;
  const p50Pct = (p50 / maxP) * 100;

  const firstOfMonth = new Date(navYear,navMonth,1);
  const daysInMonth  = new Date(navYear,navMonth+1,0).getDate();
  const startDow     = (firstOfMonth.getDay()+6)%7;
  const prevM=()=>{ if(navMonth===0){setNavYear(y=>y-1);setNavMonth(11);}else setNavMonth(m=>m-1); };
  const nextM=()=>{ if(navMonth===11){setNavYear(y=>y+1);setNavMonth(0);}else setNavMonth(m=>m+1); };
  function dayData(day:number){ const k=`${navYear}-${String(navMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; return byDate[k]||null; }
  function wkDay(i:number){ const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return {date:d,entry:byDate[iso(d)]??null}; }

  return(
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2 mb-1">
            <BarChart2 className="text-indigo-600" size={22}/>Radar de Percentiles — Ventas Históricas
          </h3>
          <div className="flex flex-wrap gap-3 text-xs font-bold text-gray-400">
            {(Object.entries(ZONES) as any[]).map(([k,z])=>(
              <span key={k} className="flex items-center gap-1.5"><span className={cn("w-2 h-2 rounded-full",z.dot)}/>{z.label}</span>
            ))}
            <span className="flex items-center gap-1.5 italic"><Sparkles size={9} className="text-slate-400"/>Referencia estadística (sin IA)</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative">
            <Store size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none"/>
            <select value={sucursal} onChange={e=>setSucursal(e.target.value)} className="pl-8 pr-5 py-2 bg-gray-50 border border-gray-200 hover:border-indigo-300 rounded-xl font-bold text-sm outline-none appearance-none cursor-pointer">
              {SUCS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5">
            {([{v:"month",l:"Mes"},{v:"week",l:"Semana"}] as const).map(o=>(
              <button key={o.v} onClick={()=>setView(o.v)} className={cn("px-4 py-1.5 rounded-lg text-sm font-black transition-all",view===o.v?"bg-white text-indigo-700 shadow-sm border border-gray-200/50":"text-gray-500 hover:text-gray-800")}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading?(
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-indigo-400">
          <Loader2 size={36} className="animate-spin"/>
          <p className="text-sm font-black uppercase tracking-widest animate-pulse">Calculando percentiles históricos...</p>
        </div>
      ):isError||!data?(
        <div className="flex items-center justify-center py-12 text-red-400 text-sm font-bold bg-red-50 rounded-2xl border border-red-100 gap-2">
          <AlertTriangle size={18}/> Error cargando datos.
        </div>
      ):(
        <div className="space-y-6">
          {/* Top KPI Cards in 2 rows with Sparkline bars */}
          <div className="space-y-4">
            
            {/* Row 1: Main Statistics (2 larger cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Card 1: Total Facturado */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase block mb-1">
                    💰 Total Facturado
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium mb-2">
                    Acumulado últimos 365 días • {sucursal ? `Sucursal: ${SUCS.find(s=>s.value===sucursal)?.label}` : "Todas las sucursales"}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-4 mt-2">
                  {/* Mini Bars */}
                  <div className="flex items-end gap-1.5 h-16 w-32 pb-0.5">
                    {last7Days.map((day: any, idx: number) => {
                      const z = ZONES[day.zone as keyof typeof ZONES] ?? ZONES.normal;
                      const pctHeight = (day.total / maxLast7) * 100;
                      return (
                        <div 
                          key={idx} 
                          className={cn("w-2.5 rounded-t-sm transition-all duration-300", z.dot)} 
                          style={{ height: `${Math.max(pctHeight, 10)}%` }}
                          title={`${day.label}: ${fmt(day.total)}`}
                        />
                      );
                    })}
                  </div>
                  {/* Values */}
                  <div className="text-right">
                    <p className="text-3xl lg:text-4xl font-black text-slate-700 leading-none">{fmt(totalSalesHist)}</p>
                    <span className="text-[10px] text-slate-400 font-extrabold block mt-2 leading-none">
                      Promedio diario: {fmt(p?.media ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Última Venta */}
              {lastR && lastZ && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md transition-all">
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase block mb-1">
                    ⚡ Último Día ({lastR.label})
                  </span>
                  <div className="flex items-end justify-between gap-4 mt-2">
                    {/* Mini Bars */}
                    <div className="flex items-end gap-1.5 h-16 w-32 pb-0.5">
                      {last7Days.map((day: any, idx: number) => {
                        const z = ZONES[day.zone as keyof typeof ZONES] ?? ZONES.normal;
                        const pctHeight = (day.total / maxLast7) * 100;
                        const isLast = idx === last7Days.length - 1;
                        return (
                          <div 
                            key={idx} 
                            className={cn("w-2.5 rounded-t-sm transition-all duration-300", z.dot, isLast ? "opacity-100 shadow-sm ring-1 ring-black/5" : "opacity-40")} 
                            style={{ height: `${Math.max(pctHeight, 10)}%` }}
                            title={`${day.label}: ${fmt(day.total)}`}
                          />
                        );
                      })}
                    </div>
                    {/* Values */}
                    <div className="text-right">
                      <p className={cn("text-3xl lg:text-4xl font-black leading-none", lastZ.color)}>{fmt(lastR.total)}</p>
                      <span className={cn("text-[10px] font-black leading-none block mt-2", lastR.pct_vs_p50 >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {lastR.pct_vs_p50 >= 0 ? "▲" : "▼"} {Math.abs(lastR.pct_vs_p50)}% vs P50 (Mediana)
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Row 2: Percentile Thresholds (3 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 3: P25 Mínimo */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase block mb-1 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"/> P25 (Mínimo)
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium">Límite inferior del último año</p>
                </div>
                <div className="flex items-end justify-between mt-3">
                  {/* Mini Bars */}
                  <div className="flex items-end gap-2 h-12 w-24 pb-0.5">
                    <div className="w-4 bg-red-500 rounded-t-sm transition-all duration-300" style={{ height: `${p25Pct}%` }} />
                    <div className="w-4 bg-amber-400 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: `${p50Pct}%` }} />
                    <div className="w-4 bg-violet-500 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: "100%" }} />
                  </div>
                  {/* Values */}
                  <div className="text-right">
                    <p className="text-2xl font-black text-red-600 leading-none">{fmt(p25)}</p>
                    <span className="text-[9px] text-slate-400 font-bold block mt-1.5 leading-none">
                      Basado en 365 días
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Mediana (P50) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase block mb-1 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"/> P50 (Mediana)
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium">Punto de equilibrio exacto del año</p>
                </div>
                <div className="flex items-end justify-between mt-3">
                  {/* Mini Bars */}
                  <div className="flex items-end gap-2 h-12 w-24 pb-0.5">
                    <div className="w-4 bg-red-500 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: `${p25Pct}%` }} />
                    <div className="w-4 bg-amber-400 rounded-t-sm transition-all duration-300" style={{ height: `${p50Pct}%` }} />
                    <div className="w-4 bg-violet-500 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: "100%" }} />
                  </div>
                  {/* Values */}
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-600 leading-none">{fmt(p50)}</p>
                    <span className="text-[9px] text-slate-400 font-bold block mt-1.5 leading-none">
                      Basado en 365 días
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 5: P75 (Meta) */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase block mb-1 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-400"/> P75 (Meta)
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium">El 25% superior de tu historial</p>
                </div>
                <div className="flex items-end justify-between mt-3">
                  {/* Mini Bars */}
                  <div className="flex items-end gap-2 h-12 w-24 pb-0.5">
                    <div className="w-4 bg-red-500 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: `${p25Pct}%` }} />
                    <div className="w-4 bg-amber-400 rounded-t-sm transition-all duration-300 opacity-30" style={{ height: `${p50Pct}%` }} />
                    <div className="w-4 bg-violet-500 rounded-t-sm transition-all duration-300" style={{ height: "100%" }} />
                  </div>
                  {/* Values */}
                  <div className="text-right">
                    <p className="text-2xl lg:text-3xl font-black text-violet-600 leading-none">{fmt(p75)}</p>
                    <span className="text-[9px] text-slate-400 font-bold block mt-1.5 leading-none">
                      Solo 25% de días arriba
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          {/* ── SECCIÓN 4: Vista por período ── */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-indigo-400 rounded-full"/>
            <p className="text-sm font-black text-gray-700">
              {view==="month"?"Calendario mensual":"Timetable semanal"}
            </p>
            <span className="text-xs text-gray-400 font-medium">
              {view==="month"
                ?"— Cada celda muestra el monto real del día, su zona y si superó P25/P50/P75. Días futuros muestran la referencia estadística."
                :"— Cada fila muestra el día con su barra comparativa. La línea azul es la mediana (P50). Las etiquetas dentro de la barra muestran los umbrales exactos."}
            </span>
          </div>
          {view==="month"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevM} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"><ChevronLeft size={16}/></button>
                <h4 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  {MES[navMonth]} {navYear}
                  {(navYear>now.getFullYear()||(navYear===now.getFullYear()&&navMonth>now.getMonth()))&&(
                    <span className="text-xs font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9}/>Proyeccion</span>
                  )}
                </h4>
                <button onClick={nextM} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"><ChevronRight size={16}/></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map(d=><div key={d} className="text-center text-[10px] font-black text-gray-400 uppercase py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({length:startDow}).map((_,i)=><div key={i} className="min-h-[90px]"/>)}
                {Array.from({length:daysInMonth}).map((_,i)=>{
                  const day=i+1; const entry=dayData(day);
                  const dateObj=new Date(navYear,navMonth,day);
                  const isToday=iso(dateObj)===iso(now);
                  const isFut=dateObj>now;
                  const z=entry?(ZONES[entry.zone as keyof typeof ZONES]??ZONES.normal):null;
                  return(
                    <div key={day} className={cn("relative group min-h-[90px] rounded-2xl border p-2 flex flex-col gap-1 cursor-default hover:shadow-lg transition-all",
                      isToday?"ring-2 ring-indigo-400 border-indigo-200 bg-indigo-50":
                      entry&&!entry.is_future&&z?`${z.bg} ${z.border}`:
                      entry?.is_future?"border-dashed border-violet-200 bg-violet-50/20":
                      "border-gray-100 bg-white")}>
                      {/* Número del dia */}
                      <span className={cn("text-[10px] font-black self-start w-5 h-5 flex items-center justify-center rounded-full shrink-0",
                        isToday?"bg-indigo-500 text-white":
                        entry&&!entry.is_future&&z?z.color:
                        entry?.is_future?"text-violet-400 bg-violet-100":
                        isFut?"text-gray-300":"text-gray-500")}>{day}</span>
                      {/* Datos reales */}
                      {entry&&!entry.is_future&&(
                        <>
                          <p className={cn("text-[12px] font-black leading-tight mt-0.5",z?.color)}>{fmt(entry.total)}</p>
                          <p className={cn("text-[9px] font-bold",z?.color)}>{z?.label}</p>
                          {/* Mini semaforos */}
                          <div className="flex gap-0.5 mt-auto">
                            {[{l:"P25",ok:entry.paso_p25,c:"bg-amber-400"},{l:"P50",ok:entry.paso_p50,c:"bg-emerald-500"},{l:"P75",ok:entry.paso_p75,c:"bg-violet-500"}].map(s=>(
                              <span key={s.l} className={cn("text-[7px] font-black px-1 py-0.5 rounded flex items-center gap-0.5",s.ok?"bg-white/80 text-gray-700":"bg-black/5 text-gray-400")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full inline-block",s.ok?s.c:"bg-gray-300")}/>{s.l}
                              </span>
                            ))}
                          </div>
                          {entry.pct_vs_p50!==0&&(
                            <span className={cn("text-[8px] font-black",entry.pct_vs_p50>=0?"text-emerald-600":"text-red-500")}>
                              {entry.pct_vs_p50>0?"+":""}{entry.pct_vs_p50}% vs P50
                            </span>
                          )}
                        </>
                      )}
                      {/* Referencia estadística futura (solo si el backend envió datos de proyección) */}
                      {entry?.is_future&&(
                        <>
                          <p className="text-[10px] text-violet-600 font-black mt-0.5">~{fmt(entry.total)}</p>
                          <p className="text-[8px] text-violet-400 font-bold">Min: {fmt(entry.total_low??p25)}</p>
                          <p className="text-[8px] text-violet-400 font-bold">Max: {fmt(entry.total_high??p75)}</p>
                          <span className="text-[7px] text-violet-400 font-bold mt-auto">📊 Ref. histórica</span>
                        </>
                      )}
                      {/* Dia futuro sin datos = celda vacía neutral */}
                      {!entry&&isFut&&(
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[8px] text-gray-200 font-medium">—</span>
                        </div>
                      )}
                      {/* Dia pasado sin ventas */}
                      {!entry&&!isFut&&(
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-[8px] text-gray-300 font-medium">Sin ventas</span>
                        </div>
                      )}
                      <Tooltip entry={entry} p25={p25} p50={p50} p75={p75}/>

                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-4 text-[10px] font-bold text-gray-500 justify-center">
                {(Object.entries(ZONES) as any[]).map(([k,z])=>(
                  <span key={k} className="flex items-center gap-1"><span className={cn("w-2.5 h-2.5 rounded-full",z.dot)}/>{z.label}</span>
                ))}
                <span className="flex items-center gap-1"><Sparkles size={9} className="text-violet-400"/>Referencia estadística futura</span>
              </div>
            </div>
          )}

          {/* VISTA SEMANAL */}
          {view==="week"&&(
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={()=>setWeekOffset(w=>w-1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"><ChevronLeft size={16}/></button>
                <div className="text-center">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    {weekOffset===0?"Semana actual":weekOffset<0?`Hace ${Math.abs(weekOffset)} semana(s)`:`En ${weekOffset} semana(s)`}
                  </p>
                  <p className="text-sm font-black text-gray-800">
                    {weekStart.toLocaleDateString("es-ES",{day:"numeric",month:"long"})} – {new Date(weekStart.getTime()+6*86400000).toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}
                  </p>
                </div>
                <button onClick={()=>setWeekOffset(w=>w+1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"><ChevronRight size={16}/></button>
              </div>
              <div className="space-y-3">
                {DAYS.map((_,i)=>{
                  const {date,entry}=wkDay(i);
                  const isToday=iso(date)===iso(now); const isFut=date>now;
                  const z=entry?(ZONES[entry.zone as keyof typeof ZONES]??ZONES.normal):null;
                  const maxRef=(p75||1)*1.2;
                  const barW=entry?Math.min((entry.total/maxRef)*100,100):isFut?Math.min((p50/maxRef)*100,100):0;
                  const p25W=Math.min((p25/maxRef)*100,100);
                  const medW=Math.min((p50/maxRef)*100,100);
                  const p75W=Math.min((p75/maxRef)*100,100);
                  const total=entry?.total??(isFut?p50:0);
                  return(
                    <div key={i} className={cn("relative group rounded-2xl border transition-all hover:shadow-md",
                      isToday?"ring-2 ring-indigo-400 bg-indigo-50 border-indigo-200":z?`${z.bg} ${z.border}`:isFut?"border-dashed border-violet-200 bg-violet-50/20":"bg-gray-50 border-gray-100")}>
                      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                        {/* Stripe + dia */}
                        <div className="flex items-center gap-2 w-24 shrink-0 pt-1">
                          <div className={cn("w-1 h-10 rounded-full shrink-0",z?z.dot:isFut?"bg-violet-300":"bg-gray-200")}/>
                          <div>
                            <p className={cn("text-sm font-black",isToday?"text-indigo-700":z?z.color:isFut?"text-violet-500":"text-gray-400")}>{DAYS[i]}</p>
                            <p className="text-[10px] text-gray-400">{date.toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</p>
                          </div>
                        </div>
                        {/* Barra + etiquetas Min/Med/Max */}
                        <div className="flex-1 min-w-0">
                          {/* Barra */}
                          <div className="relative h-6 bg-white/60 rounded-lg overflow-hidden border border-white/40 mb-1">
                            <div className={cn("absolute left-0 top-1 bottom-1 rounded-md transition-all duration-700",z?z.dot:isFut?"bg-violet-300":"bg-gray-200")} style={{width:`${barW}%`}}/>
                            {/* P25 */}
                            <div className="absolute top-0 bottom-0 w-px bg-amber-400 z-10" style={{left:`${p25W}%`}}/>
                            {/* P50 */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-20" style={{left:`${medW}%`}}/>
                            {/* P75 */}
                            <div className="absolute top-0 bottom-0 w-px bg-violet-400 z-10" style={{left:`${p75W}%`}}/>
                            {!entry&&isFut&&<div className="absolute inset-0 flex items-center px-3"><span className="text-[8px] text-violet-400 italic font-black">Ref. histórica basada en P50</span></div>}
                            {!entry&&!isFut&&<div className="absolute inset-0 flex items-center justify-center"><span className="text-[9px] text-gray-400">Sin datos</span></div>}
                          </div>
                          {/* Etiquetas de umbral debajo de la barra */}
                          <div className="relative h-4">
                            <span className="absolute text-[8px] font-black text-amber-600 -translate-x-1/2 whitespace-nowrap" style={{left:`${p25W}%`}}>Min {fmt(p25)}</span>
                            <span className="absolute text-[8px] font-black text-indigo-600 -translate-x-1/2 whitespace-nowrap" style={{left:`${medW}%`}}>Med {fmt(p50)}</span>
                            <span className="absolute text-[8px] font-black text-violet-600 -translate-x-1/2 whitespace-nowrap" style={{left:`${p75W}%`}}>Max {fmt(p75)}</span>
                          </div>
                        </div>
                        {/* Monto + zona + % */}
                        <div className="shrink-0 text-right w-36 pt-1">
                          {total>0?(
                            <>
                              <p className={cn("text-base font-black",z?z.color:isFut?"text-violet-500":"text-gray-900")}>{fmt(total)}</p>
                              {entry&&entry.pct_vs_p50!==0&&(
                                <p className={cn("text-[10px] font-black",entry.pct_vs_p50>=0?"text-emerald-600":"text-red-500")}>
                                  {entry.pct_vs_p50>0?"+":""}{entry.pct_vs_p50}% vs mediana
                                </p>
                              )}
                              {isFut&&!entry&&<p className="text-[9px] text-violet-400 italic">ref. histórica</p>}
                            </>
                          ):<p className="text-sm text-gray-300">—</p>}
                          {z&&<span className={cn("inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-lg",z.pill)}>{z.label}</span>}
                          {isFut&&!z&&<span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700">📊 Ref.</span>}
                        </div>
                      </div>
                      <Tooltip entry={entry||(isFut?{total:p50,fecha:iso(date),is_future:true,total_low:p25,total_high:p75}:null)} p25={p25} p50={p50} p75={p75}/>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-4 text-[10px] font-bold text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded"/>Mín (P25) = {fmt(p25)} — umbral de zona crítica</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded"/>Mediana (P50) = {fmt(p50)} — venta típica real, referencia principal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-400 inline-block rounded"/>Meta (P75) = {fmt(p75)} — superar esto es gran venta</span>
                <span className="flex items-center gap-1.5 italic"><Sparkles size={9} className="text-violet-400"/>Días futuros = referencia estadística sin IA</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
