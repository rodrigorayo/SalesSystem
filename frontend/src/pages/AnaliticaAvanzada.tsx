import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
    BrainCircuit, TrendingUp, Cpu,
    AlertTriangle, Sparkles, Activity, ArrowUpRight, BarChart3,
    Star, Coins, ArrowDownCircle, HelpCircle, Package,
    Zap, ShoppingCart, Building2, AlertCircle, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
    ScatterChart, Scatter, ZAxis, ReferenceLine, Area, AreaChart, BarChart, Bar, Cell
} from 'recharts';
import { getDemandPrediction, getAnalyticsBcg, getAnalyticsDashboard } from '../api/api';
import type { DemandPredictionResponse } from '../api/types';

const fBs = (n?: number) => `Bs. ${(n||0).toLocaleString('es-BO',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const fPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

type BcgItem = { nombre:string; crecimiento:number; cuota_mercado:number; ingresos:number; tipo:string };
type Horizonte = '30d'|'6m'|'1a';
type Prio = 'ALTA'|'MEDIA'|'BAJA';
interface Sug { producto:string; cuadrante:string; accion:string; prio:Prio; urgencia:string; ingresos:number }

/** Reclasifica usando umbrales por mediana para distribución balanceada */
function buildFlat(raw:any): BcgItem[] {
    if(!raw) return [];
    const keys=['estrellas','vacas','interrogantes','perros'];
    const all: BcgItem[] = [];
    for(const k of keys){
        for(const p of (raw[k]??[])){
            all.push({
                nombre: String(p.nombre||''),
                crecimiento: Number(p.crecimiento)||0,
                cuota_mercado: Number(p.cuota_relativa)||0,
                ingresos: Number(p.ingresos_actuales)||0,
                tipo: ''
            });
        }
    }
    if(all.length===0) return [];
    // Umbrales por mediana → distribución natural en 4 cuadrantes
    const sorted_c = [...all.map(p=>p.cuota_mercado)].sort((a,b)=>a-b);
    const sorted_g = [...all.map(p=>p.crecimiento)].sort((a,b)=>a-b);
    const mid = Math.floor(all.length/2);
    const medCuota = sorted_c[mid];
    const medCrec  = sorted_g[mid];
    return all.map(p=>{
        const hiCuota = p.cuota_mercado >= medCuota;
        const hiCrec  = p.crecimiento  >= medCrec;
        let tipo = 'Perro';
        if(hiCuota && hiCrec)  tipo = 'Estrella';
        else if(hiCuota && !hiCrec) tipo = 'Vaca';
        else if(!hiCuota && hiCrec) tipo = 'Interrogante';
        return {...p, tipo};
    }).sort((a,b)=>b.ingresos-a.ingresos);
}

function getExplicacion(p: BcgItem, trend: number): string {
    const g = (p.crecimiento*100).toFixed(1);
    const q = (p.cuota_mercado*100).toFixed(1);
    if(p.tipo==='Estrella')
        return `Crecimiento de ${g}% con alta cuota de mercado (${q}%). El modelo proyecta demanda creciente impulsada por la tendencia actual (${fPct(trend)}). Priorizar reabastecimiento.`;
    if(p.tipo==='Vaca')
        return `Producto maduro con alta participación de mercado (${q}%). No crece explosivamente pero genera ingresos estables y predecibles. Mantener inventario base.`;
    if(p.tipo==='Interrogante')
        return `Crecimiento detectado (${g}%) pero participación de mercado aún baja (${q}%). Alto potencial sin desarrollar. Requiere inversión en marketing focal y seguimiento semanal.`;
    const dir = p.crecimiento<0 ? `Declive de ${Math.abs(Number(g))}%` : 'Estancamiento';
    return `${dir} detectado vs periodo anterior. La IA recomienda ${p.crecimiento < -0.1 ? 'liquidar o descontinuar este SKU' : 'reducir pedidos gradualmente para liberar capital'}.`;
}

function buildSugs(flat:BcgItem[]): Sug[] {
    return flat.map(p=>{
        let accion='Mantener stock actual', prio:Prio='BAJA', urgencia='Sin urgencia';
        if(p.tipo==='Estrella'){accion='Reabastecer +30% inmediatamente';prio=p.crecimiento>0.5?'ALTA':'MEDIA';urgencia=p.crecimiento>0.5?'Inmediata':'Esta semana';}
        else if(p.tipo==='Vaca'){accion='Mantener inventario base planificado';prio='BAJA';urgencia='Sin urgencia';}
        else if(p.tipo==='Interrogante'){accion='Evaluar stock y ejecutar marketing';prio='MEDIA';urgencia='Esta semana';}
        else{accion=p.crecimiento<-0.1?'Liquidar / Descontinuar SKU':'Reducir volumen de pedido';prio=p.crecimiento<-0.1?'ALTA':'MEDIA';urgencia=p.crecimiento<-0.1?'Inmediata':'Este mes';}
        return {producto:p.nombre,cuadrante:p.tipo,accion,prio,urgencia,ingresos:p.ingresos};
    }).sort((a,b)=>({'ALTA':0,'MEDIA':1,'BAJA':2}[a.prio])-({'ALTA':0,'MEDIA':1,'BAJA':2}[b.prio]));
}

function proj(ing:number,trend:number,h:Horizonte,factor=1):number{
    const n=h==='30d'?1:h==='6m'?6:12;
    return ing*Math.pow(1+(trend/100)*factor,n);
}

const BCGC:Record<string,string>={Estrella:'#10b981',Vaca:'#3b82f6',Interrogante:'#8b5cf6',Perro:'#9ca3af'};
const BCGBG:Record<string,string>={Estrella:'bg-emerald-50 border-emerald-200',Vaca:'bg-blue-50 border-blue-200',Interrogante:'bg-purple-50 border-purple-200',Perro:'bg-gray-50 border-gray-200'};
const PRIOC:Record<Prio,string>={ALTA:'text-rose-600 bg-rose-50 border-rose-200',MEDIA:'text-amber-600 bg-amber-50 border-amber-200',BAJA:'text-emerald-600 bg-emerald-50 border-emerald-200'};
const PRIOD:Record<Prio,string>={ALTA:'bg-rose-500',MEDIA:'bg-amber-400',BAJA:'bg-emerald-500'};
const FACTOR:Record<string,number>={Estrella:1.4,Vaca:0.8,Interrogante:1.2,Perro:0.5};

export default function AnaliticaAvanzada() {
    const { role } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(false);
    const [mlData, setMlData] = useState<DemandPredictionResponse|null>(null);
    const [bcgRaw, setBcgRaw] = useState<any>(null);
    const [dashData, setDashData] = useState<any>(null);
    const [horizonte, setHorizonte] = useState<Horizonte>('30d');
    const [expandedQ, setExpandedQ] = useState<string|null>('Estrella');

    useEffect(()=>{
        let ok=true;
        const load=async()=>{
            setLoading(true); setErr(false);
            try{
                const end=new Date(); const start=new Date(); start.setDate(end.getDate()-90);
                const sd=start.toISOString().split('T')[0]; const ed=end.toISOString().split('T')[0];
                const [ml,bcg,dash]=await Promise.all([
                    getDemandPrediction(7),
                    getAnalyticsBcg(sd,ed),
                    getAnalyticsDashboard(sd,ed,undefined,'30days')
                ]);
                if(ok){setMlData(ml);setBcgRaw(bcg);setDashData(dash);}
            }catch(e){console.error(e);if(ok)setErr(true);}
            finally{if(ok)setLoading(false);}
        };
        load();
        return()=>{ok=false;};
    },[]);

    const esAdmin=['SUPERADMIN','ADMIN_MATRIZ','ADMIN'].includes(role||'');
    const bcgFlat=useMemo(()=>buildFlat(bcgRaw),[bcgRaw]);
    const sugs=useMemo(()=>buildSugs(bcgFlat),[bcgFlat]);
    const trend=mlData?.trend_percentage??0;
    const hayEvento=!!(mlData?.insight&&(mlData.insight.includes('Feriado')||mlData.insight.includes('feriado')||mlData.insight.includes('Atención')||mlData.insight.includes('salto')||mlData.insight.includes('Reducción')));
    const alertasStock=bcgFlat.filter(p=>p.tipo==='Perro'&&p.crecimiento<-0.05).length;
    const sucursales=(dashData?.sales_by_branch??[]) as {name:string;ventas:number;margen:number}[];
    const topProds=useMemo(()=>bcgFlat.slice(0,20),[bcgFlat]);

    const qProds=(t:string)=>bcgFlat.filter(p=>p.tipo===t);

    if(!esAdmin) return(
        <div className="flex flex-col items-center justify-center p-20 text-center">
            <AlertTriangle className="text-amber-500 mb-4" size={48}/>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
            <p className="text-gray-500">Se requieren permisos de alta gerencia.</p>
        </div>
    );

    return(
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-20">

        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 rounded-xl blur-md opacity-30 animate-pulse"/>
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl relative"><BrainCircuit size={26}/></div>
                    </div>
                    Analítica Avanzada &amp; Machine Learning
                </h1>
                <p className="text-gray-500 mt-2 text-sm font-medium flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-500"/>
                    Motor predictivo basado en Gradient Boosting Quantile Regression sobre datos históricos reales.
                </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                <span className="text-xs font-bold text-indigo-700">{bcgFlat.length} productos analizados</span>
            </div>
        </div>

        {loading?(
            <div className="flex flex-col justify-center items-center py-32 space-y-4">
                <div className="relative"><div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"/><Cpu size={56} className="text-indigo-500 animate-bounce relative z-10"/></div>
                <p className="text-indigo-600 font-bold tracking-widest text-sm uppercase">Entrenando modelo sobre datos históricos...</p>
                <div className="w-64 h-1.5 bg-indigo-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-pulse w-2/3 rounded-full"/></div>
            </div>
        ):err||!mlData?(
            <div className="bg-red-50 text-red-600 p-8 rounded-3xl text-center border border-red-100">
                <AlertTriangle size={32} className="mx-auto mb-2"/>
                <h3 className="font-bold">Error conectando con ML Pipeline</h3>
                <p className="text-sm">Revisa que el backend esté activo en puerto 8001.</p>
            </div>
        ):(
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ══════════════════════════════════════════════
                SECCIÓN 1: KPIs DEL MODELO
                Métricas clave del motor de Machine Learning
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-indigo-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Indicadores del Motor ML</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Estado del modelo y alertas activas</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-5 shadow-xl border border-indigo-900 text-white relative overflow-hidden group xl:col-span-1">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform duration-500"><TrendingUp size={80}/></div>
                        <div className="flex items-center gap-2 mb-3 text-indigo-400"><Activity size={15}/><span className="font-bold uppercase tracking-wider text-xs">Precisión ML</span></div>
                        <h2 className="text-4xl font-black mb-1">{mlData.model_accuracy}%</h2>
                        <p className="text-xs text-indigo-200/60">Gradient Boosting Quantile</p>
                    </div>
                    <div className="bg-white border rounded-3xl p-5 shadow-sm border-indigo-50 flex flex-col justify-center xl:col-span-1">
                        <div className="flex items-center gap-2 mb-3 text-indigo-600"><BrainCircuit size={15}/><span className="font-bold uppercase tracking-wider text-xs">Insight Generado</span></div>
                        <p className="text-xs font-semibold text-gray-800 leading-relaxed mb-2">"{mlData.insight}"</p>
                        <p className="text-xs text-gray-400 font-bold flex items-center gap-1"><Sparkles size={11} className="text-amber-500"/>Modelo Autónomo</p>
                    </div>
                    <div className="bg-white border rounded-3xl p-5 shadow-sm border-indigo-50 flex justify-between items-center xl:col-span-1">
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Demanda 7 días</p>
                            <h3 className="text-3xl font-black text-indigo-900">{trend>0?'+':''}{trend}%</h3>
                            <p className={`text-xs font-semibold flex items-center gap-1 ${trend>=0?'text-emerald-500':'text-rose-500'}`}>
                                <ArrowUpRight size={13} className={trend<0?'rotate-90':''}/>{trend>=0?'Tendencia Alcista':'Tendencia Bajista'}
                            </p>
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><BarChart3 size={26}/></div>
                    </div>
                    <div className={`rounded-3xl p-5 shadow-sm border flex justify-between items-center xl:col-span-1 ${alertasStock>0?'bg-rose-50 border-rose-200':'bg-emerald-50 border-emerald-200'}`}>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Crítico</p>
                            <h3 className={`text-3xl font-black ${alertasStock>0?'text-rose-600':'text-emerald-600'}`}>{alertasStock}</h3>
                            <p className={`text-xs font-semibold ${alertasStock>0?'text-rose-500':'text-emerald-500'}`}>{alertasStock>0?`SKUs en riesgo alto`:'Inventario controlado'}</p>
                        </div>
                        <div className={`p-3 rounded-full ${alertasStock>0?'bg-rose-200 text-rose-600 animate-pulse':'bg-emerald-200 text-emerald-600'}`}><Package size={26}/></div>
                    </div>
                    <div className={`rounded-3xl p-5 shadow-sm border flex justify-between items-center xl:col-span-1 ${hayEvento?'bg-amber-50 border-amber-200':'bg-slate-50 border-slate-200'}`}>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Evento</p>
                            <h3 className={`text-xl font-black ${hayEvento?'text-amber-600':'text-slate-500'}`}>{hayEvento?'¡Activo!':'Normal'}</h3>
                            <p className={`text-xs font-semibold ${hayEvento?'text-amber-500':'text-slate-400'}`}>{hayEvento?'Ver insight arriba':'Sin alertas próximas'}</p>
                        </div>
                        <div className={`p-3 rounded-full ${hayEvento?'bg-amber-200 text-amber-600 animate-bounce':'bg-slate-200 text-slate-400'}`}><Zap size={26}/></div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 2: TOP PRODUCTOS CON PREDICCIÓN
                Muestra los productos reales del historial con
                su clasificación BCG y proyección individual
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-purple-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Productos Reales — Predicción Individual</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Basado en datos históricos de los últimos 90 días</span>
                </div>
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Cada producto muestra sus ingresos históricos reales, la clasificación BCG calculada automáticamente y la proyección de demanda para los próximos 30 días, explicando el razonamiento del modelo.
                            </p>
                        </div>
                        <span className="shrink-0 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full">{topProds.length} de {bcgFlat.length} productos</span>
                    </div>
                    {topProds.length===0?(
                        <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-3">
                            <Package size={36} className="opacity-40"/>
                            <p className="text-sm font-medium">Cargando productos históricos...</p>
                            <p className="text-xs">Asegúrate de que el backend está activo y hay datos en ventas_historicas_crudas.</p>
                        </div>
                    ):(
                    <div className="divide-y divide-gray-50">
                        {topProds.map((p,i)=>{
                            const py30=proj(p.ingresos,trend,'30d',FACTOR[p.tipo]);
                            const delta=py30-p.ingresos;
                            const pct=p.ingresos>0?(delta/p.ingresos*100).toFixed(1):'0';
                            const up=delta>=0;
                            const bgColor=BCGBG[p.tipo];
                            return(
                            <div key={i} className="p-5 hover:bg-gray-50/50 transition-colors">
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Ranking + Nombre */}
                                    <div className="flex items-center gap-3 lg:w-64 shrink-0">
                                        <span className="text-2xl font-black text-gray-200 w-8 text-right shrink-0">#{i+1}</span>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm leading-tight">{p.nombre}</p>
                                            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-xs font-bold border ${bgColor}`} style={{color:BCGC[p.tipo]}}>
                                                {p.tipo==='Estrella'?'⭐':p.tipo==='Vaca'?'🐄':p.tipo==='Interrogante'?'❓':'📉'} {p.tipo}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Métricas */}
                                    <div className="flex flex-wrap gap-4 flex-1">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Ingresos Reales</p>
                                            <p className="font-black text-gray-900 text-sm">{fBs(p.ingresos)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Proyección 30d</p>
                                            <p className={`font-black text-sm ${up?'text-emerald-600':'text-rose-600'}`}>{fBs(py30)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Variación</p>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${up?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}>
                                                {up?'+':''}{pct}%
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Cuota Relativa</p>
                                            <p className="font-bold text-gray-700 text-sm">{(p.cuota_mercado*100).toFixed(1)}%</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400 font-medium mb-0.5">Crecimiento</p>
                                            <p className={`font-bold text-sm ${p.crecimiento>=0?'text-emerald-600':'text-rose-600'}`}>{fPct(p.crecimiento*100)}</p>
                                        </div>
                                    </div>
                                    {/* Explicación */}
                                    <div className={`flex-1 lg:max-w-sm p-3 rounded-xl border text-xs font-medium leading-relaxed ${bgColor}`} style={{color: BCGC[p.tipo]+'dd'}}>
                                        <div className="flex items-start gap-1.5">
                                            <Info size={12} className="shrink-0 mt-0.5 opacity-70"/>
                                            <span>{getExplicacion(p, trend)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    )}
                    {bcgFlat.length>20&&(
                        <div className="p-4 text-center border-t border-gray-100">
                            <p className="text-xs text-gray-400 font-medium">Mostrando top 20 de {bcgFlat.length} productos. Ver tabla completa en Sugerencias IA.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 3: CURVA DE PREDICCIÓN DE DEMANDA
                Gráfica histórica real + proyección ML 7 días
                con bandas de confianza P10 (pesimista) y P90
                (optimista) del modelo cuantílico
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Curva Predictiva de Demanda Total</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Últimos 7 días reales + próximos 7 días predichos</span>
                </div>
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"/>
                    <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-lg text-gray-900 flex items-center gap-2"><TrendingUp className="text-indigo-600" size={20}/>Predicción Algorítmica de Ventas</h3>
                            <p className="text-sm text-gray-500 mt-1">El modelo usa <strong>Gradient Boosting Quantile Regression</strong> con variables: día de semana, feriados bolivianos, temperatura y precipitación climática, y ventas rezagadas (lag-1 y lag-7). La banda sombreada representa el rango P10–P90.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-xl shrink-0">
                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"/>Datos Reales</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-500"/>Predicción P50</div>
                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-200"/>Banda P10-P90</div>
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <AreaChart data={mlData.predictions} margin={{top:10,right:10,left:0,bottom:0}}>
                                <defs>
                                    <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="date" tick={{fontSize:11,fill:'#6b7280',fontWeight:'bold'}} axisLine={false} tickLine={false}/>
                                <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                                <Tooltip cursor={{stroke:'#6366f1',strokeWidth:1,strokeDasharray:'3 3'}} content={({payload,label})=>{
                                    if(!payload?.length) return null;
                                    const d=payload[0].payload;
                                    return(<div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100 min-w-[200px]">
                                        <p className="font-bold text-gray-800 mb-2 text-sm">{label}</p>
                                        {d.real!=null&&<div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Real:</span><span className="font-bold text-emerald-600">{fBs(d.real)}</span></div>}
                                        <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Predicción (P50):</span><span className="font-bold text-indigo-600">{fBs(d.prediccion)}</span></div>
                                        {d.pred_p10!=null&&<div className="space-y-1 border-t border-gray-100 pt-2">
                                            <div className="flex justify-between text-xs"><span className="text-gray-500">Optimista (P90):</span><span className="text-emerald-500 font-medium">{fBs(d.pred_p90)}</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-gray-500">Pesimista (P10):</span><span className="text-rose-500 font-medium">{fBs(d.pred_p10)}</span></div>
                                        </div>}
                                        {d.weather_temp_max!=null&&<div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                            <div className="flex justify-between text-xs"><span className="text-gray-500">🌡 Temperatura:</span><span className="text-orange-500 font-medium">{d.weather_temp_max}°C</span></div>
                                            <div className="flex justify-between text-xs"><span className="text-gray-500">🌧 Lluvia:</span><span className="text-blue-500 font-medium">{d.weather_precip} mm</span></div>
                                        </div>}
                                    </div>);
                                }}/>
                                <Area type="monotone" dataKey="margen_error" stroke="none" fill="#6366f1" fillOpacity={0.08} activeDot={false}/>
                                <Area type="monotone" dataKey="real" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#gReal)" activeDot={{r:7,fill:'#10b981',stroke:'#fff'}}/>
                                <Area type="monotone" dataKey="prediccion" stroke="#6366f1" strokeWidth={3} fillOpacity={0} activeDot={{r:7,fill:'#6366f1',stroke:'#fff'}}/>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                        <p className="text-xs font-semibold text-indigo-700 flex items-start gap-2">
                            <Info size={13} className="shrink-0 mt-0.5"/>
                            <span><strong>¿Por qué se espera esta tendencia?</strong> {mlData.insight} El modelo combina el historial de ventas de los últimos 365 días con factores climáticos en tiempo real y el calendario de feriados bolivianos para generar estimaciones con intervalos de confianza.</span>
                        </p>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 4: MATRIZ BCG
                Clasificación estratégica de productos usando
                crecimiento vs cuota de mercado relativa.
                Umbrales: mediana de cada eje (distribución natural)
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-violet-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Matriz BCG Estratégica</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Clasificación automática por crecimiento y cuota de mercado</span>
                </div>
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
                    <div className="mb-6">
                        <p className="text-sm text-gray-600 font-medium">
                            Cada burbuja representa un producto real del historial. El eje X muestra la cuota de mercado relativa al producto líder; el eje Y muestra la tasa de crecimiento vs el periodo anterior. El tamaño del círculo es proporcional a los ingresos. <strong>Los umbrales se calculan por la mediana de la distribución real</strong> para garantizar una clasificación balanceada.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Scatter */}
                        <div className="xl:col-span-2 h-[450px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                            {bcgFlat.length===0?(
                                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-3">
                                    <AlertCircle size={32}/>
                                    <p className="text-sm font-medium">Sin datos BCG. Verifica que el backend esté activo.</p>
                                </div>
                            ):(
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <ScatterChart margin={{top:20,right:20,bottom:30,left:20}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                                    <XAxis type="number" dataKey="cuota_mercado" name="Cuota" domain={[0,1.05]} tick={{fontSize:10,fill:'#6b7280'}} label={{value:'← Cuota de Mercado Relativa →',position:'insideBottom',offset:-15,style:{fontSize:'10px',fontWeight:'bold',fill:'#9ca3af'}}}/>
                                    <YAxis type="number" dataKey="crecimiento" name="Crecimiento" tick={{fontSize:10,fill:'#6b7280'}} label={{value:'Tasa de Crecimiento',angle:-90,position:'insideLeft',style:{fontSize:'10px',fontWeight:'bold',fill:'#9ca3af'}}}/>
                                    <ZAxis type="number" dataKey="ingresos" range={[40,700]} name="Ingresos"/>
                                    <Tooltip cursor={{strokeDasharray:'3 3'}} content={({payload})=>{
                                        if(!payload?.length) return null;
                                        const d=payload[0].payload;
                                        return(<div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100 max-w-[240px]">
                                            <p className="font-black text-gray-800 text-sm mb-2 leading-tight">{d.nombre}</p>
                                            <div className="space-y-1 text-xs">
                                                <p className="text-gray-500">Cuadrante: <span className="font-bold" style={{color:BCGC[d.tipo]}}>{d.tipo}</span></p>
                                                <p className="text-gray-500">Crecimiento: <span className="font-bold text-gray-900">{(d.crecimiento*100).toFixed(1)}%</span></p>
                                                <p className="text-gray-500">Cuota: <span className="font-bold text-gray-900">{(d.cuota_mercado*100).toFixed(1)}%</span></p>
                                                <p className="text-gray-500 mt-1">Ingresos: <span className="font-black text-emerald-600">{fBs(d.ingresos)}</span></p>
                                            </div>
                                        </div>);
                                    }}/>
                                    <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={2}/>
                                    <ReferenceLine x={0.5} stroke="#d1d5db" strokeDasharray="5 5" label={{value:'Mediana cuota',fontSize:9,fill:'#9ca3af'}}/>
                                    {(['Estrella','Vaca','Interrogante','Perro'] as const).map(t=>(
                                        <Scatter key={t} name={t} data={bcgFlat.filter(d=>d.tipo===t)} fill={BCGC[t]} shape="circle" opacity={0.8}/>
                                    ))}
                                </ScatterChart>
                            </ResponsiveContainer>
                            )}
                        </div>
                        {/* Cuadrantes con productos */}
                        <div className="flex flex-col gap-3">
                            {[
                                {t:'Estrella',Icon:Star,label:'⭐ Estrellas — Invertir',desc:'Alta cuota + alto crecimiento. ROI máximo.'},
                                {t:'Vaca',Icon:Coins,label:'🐄 Vacas Lecheras — Mantener',desc:'Alta cuota + bajo crecimiento. Generadores de caja estable.'},
                                {t:'Interrogante',Icon:HelpCircle,label:'❓ Interrogantes — Evaluar',desc:'Baja cuota + alto crecimiento. Potencial sin desarrollar.'},
                                {t:'Perro',Icon:ArrowDownCircle,label:'📉 Perros — Desinvertir',desc:'Baja cuota + bajo crecimiento. Candidatos a descontinuar.'},
                            ].map(({t,Icon,label,desc})=>{
                                const prods=qProds(t);
                                const isOpen=expandedQ===t;
                                return(
                                <div key={t} className={`rounded-2xl border overflow-hidden transition-all duration-200 ${BCGBG[t]}`}>
                                    <button className="w-full p-4 flex items-center justify-between text-left" onClick={()=>setExpandedQ(isOpen?null:t)}>
                                        <div className="flex items-center gap-3">
                                            <Icon size={18} style={{color:BCGC[t]}}/>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm leading-none mb-0.5">{label}</p>
                                                <p className="text-xs text-gray-500 font-medium">{desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{backgroundColor:BCGC[t]}}>{prods.length}</span>
                                            {isOpen?<ChevronUp size={14} className="text-gray-400"/>:<ChevronDown size={14} className="text-gray-400"/>}
                                        </div>
                                    </button>
                                    {isOpen&&prods.length>0&&(
                                        <div className="border-t border-black/5 max-h-48 overflow-y-auto">
                                            {prods.slice(0,20).map((p,i)=>(
                                                <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-black/5 transition-colors">
                                                    <span className="text-xs font-semibold text-gray-700 truncate max-w-[160px]">{p.nombre}</span>
                                                    <span className="text-xs font-bold text-gray-500 shrink-0 ml-2">{fBs(p.ingresos)}</span>
                                                </div>
                                            ))}
                                            {prods.length>20&&<p className="text-xs text-center text-gray-400 py-2">+{prods.length-20} más...</p>}
                                        </div>
                                    )}
                                    {isOpen&&prods.length===0&&(
                                        <div className="px-4 pb-4 text-xs text-gray-400">Sin productos en este cuadrante.</div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 5: SUGERENCIAS DE PEDIDOS IA
                Priorización automática de reabastecimiento
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-orange-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Sugerencias de Pedidos — IA</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Acciones recomendadas por prioridad de urgencia</span>
                </div>
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
                    <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <Info size={15} className="text-amber-600 shrink-0 mt-0.5"/>
                        <p className="text-xs font-medium text-amber-800">
                            La prioridad se calcula combinando el cuadrante BCG de cada producto y su tasa de crecimiento histórica.
                            <strong> ALTA</strong>: Estrellas en auge o Perros en declive.
                            <strong> MEDIA</strong>: Interrogantes o Perros estancados.
                            <strong> BAJA</strong>: Vacas maduras sin urgencia.
                        </p>
                    </div>
                    {sugs.length===0?(
                        <div className="text-center py-12 text-gray-400"><ShoppingCart size={32} className="mx-auto mb-2 opacity-40"/><p className="text-sm">Cargando sugerencias...</p></div>
                    ):(
                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider text-xs w-24">Prioridad</th>
                                    <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Producto</th>
                                    <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider text-xs w-28">Cuadrante</th>
                                    <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Acción Recomendada</th>
                                    <th className="text-left p-4 font-bold text-gray-500 uppercase tracking-wider text-xs w-28">Urgencia</th>
                                    <th className="text-right p-4 font-bold text-gray-500 uppercase tracking-wider text-xs w-32">Ingresos Act.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sugs.slice(0,20).map((s,i)=>(
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${PRIOC[s.prio]}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${PRIOD[s.prio]}`}/>{s.prio}
                                            </span>
                                        </td>
                                        <td className="p-4 font-semibold text-gray-800 max-w-[200px] truncate">{s.producto}</td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold" style={{backgroundColor:`${BCGC[s.cuadrante]}20`,color:BCGC[s.cuadrante]}}>
                                                {s.cuadrante==='Estrella'?'⭐':s.cuadrante==='Vaca'?'🐄':s.cuadrante==='Interrogante'?'❓':'📉'} {s.cuadrante}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-700 font-medium">{s.accion}</td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold ${s.urgencia==='Inmediata'?'text-rose-600':s.urgencia==='Esta semana'?'text-amber-600':'text-gray-400'}`}>
                                                {s.urgencia==='Inmediata'?'🔴':s.urgencia==='Esta semana'?'🟡':'🟢'} {s.urgencia}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-900">{fBs(s.ingresos)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 6: PROYECCIONES POR HORIZONTE
                Simula el impacto de la tendencia ML por 30d,
                6 meses o 1 año con factor multiplicador
                según el cuadrante BCG de cada producto
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-teal-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Proyecciones por Horizonte Temporal</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Aplicación compuesta de la tendencia ML por cuadrante BCG</span>
                </div>
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
                    <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-gray-600 font-medium">
                                Proyección de ingresos aplicando la tasa de tendencia detectada por el modelo ML
                                (<strong>{fPct(trend)}</strong> en 7 días) de forma compuesta. Las Estrellas reciben un multiplicador de ×1.4 y los Perros ×0.5 para reflejar su trayectoria esperada.
                            </p>
                        </div>
                        <div className="flex items-center bg-gray-100 rounded-2xl p-1 gap-1 shrink-0">
                            {(['30d','6m','1a'] as Horizonte[]).map(h=>(
                                <button key={h} onClick={()=>setHorizonte(h)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${horizonte===h?'bg-white text-teal-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                                    {h==='30d'?'30 Días':h==='6m'?'6 Meses':'1 Año'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {bcgFlat.length>0&&(
                    <>
                    <div className="h-[260px] w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <BarChart data={bcgFlat.slice(0,10).map(p=>({
                                name:p.nombre.length>13?p.nombre.slice(0,13)+'…':p.nombre,
                                actual:Math.round(p.ingresos),
                                proyectado:Math.round(proj(p.ingresos,trend,horizonte,FACTOR[p.tipo])),
                                tipo:p.tipo
                            }))} margin={{top:5,right:10,left:0,bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="name" tick={{fontSize:9,fill:'#6b7280'}} axisLine={false} tickLine={false}/>
                                <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                                <Tooltip formatter={(v:any,n?:string|number)=>{const ns=String(n??'');return[fBs(v),ns==='actual'?'Actual (30d hist.)':ns==='proyectado'?`Proyectado (${horizonte})`:'—'] as [string,string];}} contentStyle={{borderRadius:'12px',border:'1px solid #f3f4f6'}}/>
                                <Bar dataKey="actual" fill="#e0e7ff" radius={[4,4,0,0]} name="actual"/>
                                <Bar dataKey="proyectado" radius={[4,4,0,0]} name="proyectado">
                                    {bcgFlat.slice(0,10).map((p,i)=>(<Cell key={i} fill={BCGC[p.tipo]}/>))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Producto</th>
                                <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Cuadrante</th>
                                <th className="text-right p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Ingresos Reales</th>
                                <th className="text-right p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Proyectado ({horizonte==='30d'?'60d':horizonte==='6m'?'12m':'2a'})</th>
                                <th className="text-right p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Δ Variación</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {bcgFlat.slice(0,15).map((p,i)=>{
                                    const py=proj(p.ingresos,trend,horizonte,FACTOR[p.tipo]);
                                    const diff=py-p.ingresos;
                                    const pct=p.ingresos>0?(diff/p.ingresos*100).toFixed(1):'0';
                                    const up=diff>=0;
                                    return(<tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-3 font-semibold text-gray-800 max-w-[180px] truncate">{p.nombre}</td>
                                        <td className="p-3"><span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{backgroundColor:`${BCGC[p.tipo]}20`,color:BCGC[p.tipo]}}>{p.tipo}</span></td>
                                        <td className="p-3 text-right text-gray-600 font-medium">{fBs(p.ingresos)}</td>
                                        <td className="p-3 text-right font-bold text-gray-900">{fBs(py)}</td>
                                        <td className="p-3 text-right"><span className={`text-xs font-bold px-2 py-1 rounded-lg ${up?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-600'}`}>{up?'+':''}{pct}%</span></td>
                                    </tr>);
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                    )}
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                SECCIÓN 7: PANEL MULTI-SUCURSAL
                ══════════════════════════════════════════════ */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-orange-500 rounded-full"/>
                    <h2 className="text-lg font-black text-gray-800">Demanda Multi-Sucursal</h2>
                    <span className="text-xs text-gray-400 font-medium ml-1">— Ventas reales vs demanda proyectada por punto de venta</span>
                </div>
                <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100">
                    {sucursales.length===0?(
                        <div className="text-center py-12 text-gray-400"><Building2 size={32} className="mx-auto mb-2 opacity-40"/><p className="text-sm">Sin datos de sucursales disponibles.</p></div>
                    ):(
                    <>
                    <div className="h-[240px] w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <BarChart data={sucursales.map(s=>({name:s.name,real:Math.round(s.ventas),proyectado:Math.round(proj(s.ventas,trend,'30d')),margen:Math.round(s.ventas*0.15)}))} margin={{top:5,right:10,left:0,bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/>
                                <XAxis dataKey="name" tick={{fontSize:12,fill:'#6b7280',fontWeight:'bold'}} axisLine={false} tickLine={false}/>
                                <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                                <Tooltip formatter={(v:any,n?:string|number)=>{const ns=String(n??'');return[fBs(v),ns==='real'?'Ventas Reales':ns==='proyectado'?'Proyectado (30d)':'Margen Est.'] as [string,string];}} contentStyle={{borderRadius:'12px',border:'1px solid #f3f4f6'}}/>
                                <Bar dataKey="real" fill="#6366f1" radius={[4,4,0,0]} name="real"/>
                                <Bar dataKey="proyectado" fill="#10b981" radius={[4,4,0,0]} name="proyectado" opacity={0.7}/>
                                <Bar dataKey="margen" fill="#f59e0b" radius={[4,4,0,0]} name="margen" opacity={0.8}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {sucursales.map((s,i)=>{
                            const maxV=Math.max(...sucursales.map(x=>x.ventas),1);
                            const pct=(s.ventas/maxV)*100;
                            const py=proj(s.ventas,trend,'30d');
                            const esMejor=s.ventas===maxV;
                            const up=py>=s.ventas;
                            return(
                            <div key={i} className={`p-5 rounded-2xl border transition-all hover:shadow-md ${esMejor?'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200':'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${esMejor?'bg-indigo-500 text-white':'bg-white text-gray-500'}`}><Building2 size={15}/></div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{s.name}</p>
                                            {esMejor&&<span className="text-xs font-bold text-indigo-600">⭐ Sucursal Líder</span>}
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${up?'bg-emerald-100 text-emerald-700':'bg-rose-100 text-rose-700'}`}>
                                        {up?'+':''}{s.ventas>0?((py-s.ventas)/s.ventas*100).toFixed(1):0}%
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between text-gray-500"><span>Ventas Reales</span><span className="font-bold text-gray-800">{fBs(s.ventas)}</span></div>
                                    <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full transition-all" style={{width:`${pct}%`}}/></div>
                                    <div className="flex justify-between text-gray-500"><span>Proyectado (30d)</span><span className={`font-bold ${up?'text-emerald-600':'text-rose-600'}`}>{fBs(py)}</span></div>
                                    <div className="flex justify-between text-gray-500"><span>Margen Est. (15%)</span><span className="font-bold text-amber-600">{fBs(s.ventas*0.15)}</span></div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                    </>
                    )}
                </div>
            </section>

        </div>
        )}
    </div>
    );
}
