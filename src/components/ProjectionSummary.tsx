import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectionParams, AzimuthalLight } from '../store/useAppStore';
import { FAMILY_LABEL, DISTORTION_LABEL } from './ui/labels';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import { signedStandardParallelDeg } from '../constants/geometry';
import { modalOverlay, modalShell } from './ui/styles';

const latLabel = (deg: number): string => {
  if (deg === 0) return '0°';
  return `${Math.abs(deg)}° ${deg > 0 ? 'с.ш.' : 'ю.ш.'}`;
};

// Human-readable projection class (see AGENTS.md): the developable surface
// and the distortion model, with the azimuthal family resolved via its light source.
function describeProjection(p: ProjectionParams): string {
  const fam = FAMILY_LABEL[p.family];
  const dist = DISTORTION_LABEL[p.distortion];
  if (p.family === 'azimuthalPerspective' || p.family === 'azimuthalMath') {
    const az: Record<AzimuthalLight, string> = {
      center: 'Гномоническая',
      antipode: 'Стереографическая',
      infinity: 'Ортографическая',
      math: dist,
    };
    return `${az[p.azLight]} (азимутальная)`;
  }
  const secant = p.family === 'conic' ? p.stdParallel2 != null : p.family === 'cylindrical' && p.scaleFactor !== 1;
  return `${secant ? 'Секущая' : 'Касательная'} ${fam} ${dist}`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-gray-400">{k}</span>
      <span className="text-neon-blue">{v}</span>
    </div>
  );
}

// Modal mirror of the EPSG catalog: a centered, dark glass panel showing the
// exact geodetic parameters of the current projection (the old inline summary
// block moved here so the control panel stays compact).
export default function ProjectionSummary({ params, onClose }: { params: ProjectionParams; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const utm = params.utmZone != null ? `Зона ${params.utmZone}` : '—';
  const isCylindrical = params.family === 'cylindrical';
  const isConic = params.family === 'conic';
  const isAzimuthalPerspective = params.family === 'azimuthalPerspective';
  const isAzimuthalMath = params.family === 'azimuthalMath';
  const isSatellite = isAzimuthalPerspective && (params.variant === 'verticalPerspective' || params.variant === 'tiltedPerspective');
  const isObliqueMercator = params.variant === 'obliqueMercator';

  return createPortal(
    <div
      className={modalOverlay}
      onClick={onClose}
    >
      <div
        className={`${modalShell} w-[460px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Точные параметры проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2 text-[13px]">
          <Row k="Центральный меридиан (λ₀)" v={`${params.lambda0}°`} />
          <Row k="Широта начала отсчёта (φ₀)" v={latLabel(params.phiOrigin)} />
          <Row k="Стандартная параллель 1 (φ₁)" v={latLabel(signedStandardParallelDeg(params.phiOrigin))} />
          {isConic && (
            <Row
              k="Стандартная параллель 2 (φ₂)"
              v={params.stdParallel2 != null ? latLabel(params.stdParallel2) : '—'}
            />
          )}
          <Row k="Масштабный коэффициент" v={params.scaleFactor.toFixed(2)} />
          <Row k="Наклон (γ)" v={`${params.gamma}°`} />
          {isCylindrical && params.variant === 'transverseMercator' && <Row k="Зона UTM" v={utm} />}
          {isSatellite && <Row k="Высота источника (км)" v={`${params.azHeight}`} />}
          {params.variant === 'tiltedPerspective' && (
            <>
              <Row k="Наклон камеры" v={`${params.azTiltDeg}°`} />
              <Row k="Азимут камеры" v={`${params.azAzimuthDeg}°`} />
            </>
          )}
          {isConic && <Row k="Полушарие конуса" v={params.coneHemisphere === 'south' ? 'Юг' : 'Север'} />}
          {isAzimuthalMath && <Row k="Радиус круга (км)" v={`${params.circleRadiusKm}`} />}
          {isObliqueMercator && (
            <>
              <Row k="Наклонение SOM" v={`${params.somInclination}°`} />
              <Row k="Период SOM (мин)" v={`${params.somPeriod}`} />
              <Row k="Долгота узла SOM" v={`${params.somNodeLongitude}°`} />
            </>
          )}
          <Row k="Смещение восток (falseEasting)" v={`${params.falseEasting}`} />
          <Row k="Смещение север (falseNorthing)" v={`${params.falseNorthing}`} />
          <Row k="Класс проекции" v={describeProjection(params)} />
          <Row k="Вариант" v={variantDef(params.variant ?? defaultVariant(params.family)).label} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
