import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Handshake, Phone } from 'lucide-react';
import { useEffect, useState } from "react";
import { Bar, Doughnut } from 'react-chartjs-2';
import './Dashboard.css';

// Registrar los componentes necesarios
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Plugin personalizado para mostrar porcentaje en el centro
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw: (chart) => {
    if (chart.config.options.plugins.centerText?.display) {
      const { width, height, ctx } = chart;
      const { text, color, fontSize } = chart.config.options.plugins.centerText;
      
      ctx.restore();
      
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px Arial`;

      const textX = Math.round((width - ctx.measureText(text).width) / 2);
      const textY = height / 2;
      
      ctx.fillText(text, textX, textY);
      ctx.save();
    }
  }
};

ChartJS.register(centerTextPlugin);

const Dashboard = () => {
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [diarias, setDiarias] = useState(null);
  const [resumen, setResumen] = useState(null);
  // Generar fecha local sin problemas de zona horaria
  const hoyDate = new Date();
  const year = hoyDate.getFullYear();
  const month = String(hoyDate.getMonth() + 1).padStart(2, '0');
  const day = String(hoyDate.getDate()).padStart(2, '0');
  const hoy = `${year}-${month}-${day}`;

  
  // Formatear fecha para mostrar en las cards
  const fechaLegible = hoyDate.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  


  const realizarLlamada = async () => {
    const contestada = Math.random() < 0.8;
    const llamada = {
      usuarioId: userData._id,
      duracion: contestada ? Math.floor(Math.random() * (30 - 20 + 1)) + 20 : 0,
      contestada: contestada,
      acuerdo: contestada ? Math.random() < 0.3 : false
    };

    try {
      const res = await fetch("http://localhost:5000/llamadas/realizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(llamada)
      });

      if (res.ok) {
        await obtenerMetricasDiarias();
        await obtenerResumenSemanal();
      }
    } catch (err) {
      // Error en la llamada
    }
  };

  const obtenerMetricasDiarias = async () => {
    try {
      const res = await fetch(`http://localhost:5000/llamadas/diarias/${userData._id}`);

      const data = await res.json();

      setDiarias(data.porDia?.[hoy] || null);
    } catch (err) {
      console.error("Error al obtener métricas diarias:", err);
    }
  };

  const obtenerResumenSemanal = async () => {
    try {
      const res = await fetch(`http://localhost:5000/llamadas/resumen/${userData._id}`);

      const data = await res.json();
      setResumen(data);
      
      // Obtener datos por día de la semana
      const resPorDia = await fetch(`http://localhost:5000/llamadas/semana/${userData._id}`);

      const dataPorDia = await resPorDia.json();
      setResumen(prev => ({ ...prev, porDia: dataPorDia }));
    } catch (err) {
      // Error al obtener resumen semanal
    }
  };

  useEffect(() => {
    obtenerMetricasDiarias();
    obtenerResumenSemanal();
  }, [hoy]);

  // Metas semanales por usuario
  let weeklyCallsGoal, weeklyAgreementsGoal;

  if (userData.nombre === "Julieta") {
    weeklyCallsGoal = 100;
    weeklyAgreementsGoal = 80;
  } else if (userData.nombre === "Andrea") {
    weeklyCallsGoal = 90;
    weeklyAgreementsGoal = 70;
  } else {
    // Default
    weeklyCallsGoal = 40;
    weeklyAgreementsGoal = 20;
  }

  // Métricas diarias
  const dailyContestadas = diarias?.contestadas ?? 0; 
  const dailyCalls = diarias?.llamadas ?? 0;
  const dailyAgreements = diarias?.acuerdos ?? 0;
  const dailyTotalDuration = diarias?.totalDuracion ?? 0;
  


  // Métricas acumuladas
  const totalCalls = resumen?.totalLlamadas ?? 0;
  const totalAgreements = resumen?.acuerdosCerrados ?? 0;

  // Cálculos realizados una sola vez
  const weeklyCallsPercentage = weeklyCallsGoal > 0 ? Math.round((totalCalls / weeklyCallsGoal) * 100) : 0;
  const weeklyAgreementsPercentage = weeklyAgreementsGoal > 0 ? Math.round((totalAgreements / weeklyAgreementsGoal) * 100) : 0;
  const dailyEffectiveness = dailyCalls > 0 ? Math.round((dailyAgreements / dailyContestadas) * 100) : 0;
  const formattedTotalTime =
  dailyTotalDuration < 60 
    ? `${dailyTotalDuration} min`
    : Math.floor(dailyTotalDuration / 60) > 0 && dailyTotalDuration % 60 > 0
      ? `${Math.floor(dailyTotalDuration / 60)}h ${dailyTotalDuration % 60}min`
      : `${Math.floor(dailyTotalDuration / 60)}h`;


  // Configuración del gráfico circular
  const createCircularChart = (percentage, color) => {
    const completedPercentage = Math.min(percentage, 100);
    const remainingPercentage = Math.max(100 - percentage, 0);
    
    return {
      data: {
        datasets: [
          {
            data: [completedPercentage, remainingPercentage],
            backgroundColor: [color, '#f0f0f0'],
            borderWidth: 0,
            cutout: '70%'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerText: {
            display: true,
            text: `${percentage}%`,
            color: color,
            fontSize: 24
          }
        }
      }
    };
  };

  const llamadasChart = createCircularChart(weeklyCallsPercentage, '#5dade2');
  const acuerdosChart = createCircularChart(weeklyAgreementsPercentage, '#2ecc71');

  // Datos de gráficos semanales
  const weeklyData = resumen?.porDia || [];

  // Detectar si un dato representa un día hábil (Lun-Vie).
  // Intenta varias estrategias para evitar filtrar todo si el formato cambia:
  // - si existe dateStr (d.fecha) se parsea y se usa el día de la semana
  // - si no, normaliza el nombre (d.dia) y acepta múltiples variantes (abreviaturas y nombres en inglés)
  const isWeekday = (dayName, dateStr) => {
    // 1) Si tenemos fecha parseable, usarla (0=Dom,6=Sab)
    if (dateStr) {
      try {
        const dt = new Date(dateStr);
        if (!isNaN(dt)) {
          const wd = dt.getDay();
          return wd >= 1 && wd <= 5; // 1..5 => Lun-Vie
        }
      } catch (e) {
        // fallthrough a intentar con el nombre
      }
    }

    if (!dayName) return false;
    const s = String(dayName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // Variantes aceptadas (español completo, abreviaturas, y en inglés)
    const valid = new Set([
      'lunes','lun','lun.','monday','mon',
      'martes','mar','mar.','tuesday','tue',
      'miercoles','miercoles','mie','mie.','wednesday','wed','mier',
      'jueves','jue','jue.','thursday','thu',
      'viernes','vie','vie.','friday','fri'
    ]);

    // también aceptar si comienza por la abreviatura (p. ej. 'lun' en 'lunes')
    if (valid.has(s)) return true;
    for (const v of valid) {
      if (s.startsWith(v)) return true;
    }
    return false;
  };

  // Filtrar para tomar sólo Lunes-Viernes (mantener wrapper/tamaño del gráfico)
  const filteredWeeklyData = Array.isArray(weeklyData) ? weeklyData.filter(d => isWeekday(d?.dia)) : [];

  const labels = filteredWeeklyData.map(d => d.dia);
  const contactRateData = filteredWeeklyData.map(d => d.contactRate || 0);
  const avgDurationData = filteredWeeklyData.map(d => d.promedioDuracion || 0);
  const contactRateColors = filteredWeeklyData.map(d => d.esHoy ? '#3498db' : '#5dade2');
  const durationColors = filteredWeeklyData.map(d => d.esHoy ? '#27ae60' : '#2ecc71');
  
  const contactRateChart = {
    data: {
      labels,
      datasets: [{
        data: contactRateData,
        backgroundColor: contactRateColors,
        borderColor: contactRateColors.map(color => color === '#3498db' ? '#2980b9' : '#4a9bd1'),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
                      label: function(context) {
                        const value = context.parsed.y;
                        const dayData = filteredWeeklyData[context.dataIndex];
                        const extra = dayData?.esHoy ? ' (HOY)' : '';
                        return `Tasa de contacto: ${value}%${extra}`;

                      }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: '#f0f0f0' },
          ticks: {
            color: '#666',
            callback: function(value) { return value + '%'; }
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#666', font: { weight: 'bold' } }
        }
      }
    }
  };

  const avgDurationChart = {
    data: {
      labels,
      datasets: [{
        data: avgDurationData,
        backgroundColor: durationColors,
        borderColor: durationColors.map(color => color === '#27ae60' ? '#219a52' : '#28a745'),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
                      label: function(context) {
                        const value = context.parsed.y;
                        const dayData = filteredWeeklyData[context.dataIndex];
                        const extra = dayData?.esHoy ? ' (HOY)' : '';
                        return `Duración promedio: ${value} min${extra}`;

                      }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f0f0f0' },
          ticks: {
            color: '#666',
            callback: function(value) { return value + ' min'; }
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#666', font: { weight: 'bold' } }
        }
      }
    }
  };

  return (
    <div className="dashboard-container">
      <div className="section-header">
        <h3>Rendimiento Semanal</h3>
        <button onClick={realizarLlamada} className="header-button">
          <Phone size={16} />
          Simular llamada
        </button>
      </div>
      <div className="charts-container">
        {/* Container individual para Llamadas */}
        <div className="chart-individual-container">
          <div className="chart-card">
            <div className="chart-wrapper-large">
              <Doughnut {...llamadasChart} />
            </div>
          </div>
          
          {/* Leyenda individual para Llamadas */}
          <div className="legend-container">
            <h4 className="chart-title" style={{ margin: 0, marginBottom: 14 }}>Llamadas</h4>
            <div className="chart-meta" style={{ marginBottom: 18 }}>Meta semanal: {weeklyCallsGoal}</div>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#5dade2'}}></div>
                <span className="legend-text">Cumplidas</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#f0f0f0'}}></div>
                <span className="legend-text">Pendiente</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Container individual para Acuerdos */}
        <div className="chart-individual-container">
          <div className="chart-card">
            <div className="chart-wrapper-large">
              <Doughnut {...acuerdosChart} />
            </div>
          </div>
          
          {/* Leyenda individual para Acuerdos */}
          <div className="legend-container">
            <h4 className="chart-title" style={{ margin: 0, marginBottom: 14 }}>Acuerdos</h4>
            <div className="chart-meta" style={{ marginBottom: 18 }}>Meta semanal: {weeklyAgreementsGoal}</div>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#2ecc71'}}></div>
                <span className="legend-text">Cumplidos</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{backgroundColor: '#f0f0f0'}}></div>
                <span className="legend-text">Pendiente</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h3>Resumen Diario ({hoy})</h3>
      </div>
  <div className="daily-summary-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div className="daily-card dashboard-daily-card">
          <div className="daily-card-header">
            <div className="daily-card-icon calls-icon">
              <Phone size={32} />
            </div>
            <div className="daily-card-badge">{fechaLegible}</div>
          </div>
          <div className="daily-card-content">
            <div className="daily-card-number">{dailyCalls}</div>
            <div className="daily-card-label">Llamadas realizadas</div>
          </div>
          <div className="daily-card-footer">
            <div className="daily-card-trend">
              Tiempo total: {formattedTotalTime}
            </div>
          </div>
  </div>

  <div className="daily-card dashboard-daily-card">
          <div className="daily-card-header">
            <div className="daily-card-icon agreements-icon">
              <Handshake size={32} />
            </div>
            <div className="daily-card-badge">{fechaLegible}</div>
          </div>
          <div className="daily-card-content">
            <div className="daily-card-number">{dailyAgreements}</div>
            <div className="daily-card-label">Acuerdos logrados</div>
          </div>
          <div className="daily-card-footer">
            <div className="daily-card-trend">
              Efectividad: {dailyEffectiveness}%
            </div>
          </div>
  </div>
      </div>

      <div className="section-header">
        <h3>Evolución de Indicadores</h3>
      </div>
      <div className="indicators-dual-container">
        <div className="indicator-chart-individual">
          <h4 className="indicator-chart-title">Tasa de Contacto Efectivo</h4>
          <div className="indicator-chart-wrapper">
            <Bar {...contactRateChart} />
          </div>
        </div>
        
        <div className="indicator-chart-individual">
          <h4 className="indicator-chart-title">Duración Promedio de Llamadas</h4>
          <div className="indicator-chart-wrapper">
            <Bar {...avgDurationChart} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;