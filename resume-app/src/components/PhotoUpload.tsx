import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import { useDropzone } from 'react-dropzone';
import { canvasCropPreview } from '@/utils/canvasCropPreview';

type Props = {
  value: string;
  onChange: (dataUrlJPEG: string) => void;
  /** When true, note that ATS PDF omits the photo (preview still shows it) */
  atsPdfOmitsPhoto?: boolean;
};

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

async function jpegUnderTarget(canvas: HTMLCanvasElement, targetBytes = 200_000): Promise<string> {
  let q = 0.88;
  for (let i = 0; i < 10; i++) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    const approx = Math.ceil(dataUrl.length * 0.75);
    if (approx <= targetBytes || q <= 0.52) return dataUrl;
    q -= 0.08;
  }
  return canvas.toDataURL('image/jpeg', 0.52);
}

export function PhotoUpload({ value, onChange, atsPdfOmitsPhoto }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [step, setStep] = useState<'idle' | 'crop'>('idle');
  const [imgSrc, setImgSrc] = useState('');
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  useEffect(() => {
    const el = imgRef.current;
    if (!el || step !== 'crop' || aspect === undefined) return;
    const { width, height } = el;
    if (width && height) setCrop(centerAspectCrop(width, height, aspect));
  }, [aspect, imgSrc, step]);

  const onDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      alert('Use an image under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setImgSrc(reader.result?.toString() ?? '');
      setStep('crop');
    };
    reader.readAsDataURL(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxFiles: 1,
    multiple: false,
  });

  const onImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (aspect !== undefined) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    } else {
      setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    }
  };

  const finishCrop = async () => {
    if (!completedCrop?.width || !completedCrop.height || !imgRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvasCropPreview(imgRef.current, canvas, completedCrop, 1, 0);
      const jpeg = await jpegUnderTarget(canvas, 190_000);
      onChange(jpeg);
      setImgSrc('');
      setStep('idle');
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch {
      alert('Unable to finalize that crop.');
    }
  };

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <label className="rb-label">Photo (optional)</label>
      {atsPdfOmitsPhoto ? (
        <p className="rb-muted" style={{ margin: '0.35rem 0 0.5rem' }}>
          Your photo appears in the live preview. The <strong>ATS</strong> PDF template omits it for parser compatibility — <strong>Modern</strong> and <strong>Classic</strong> include it on the downloaded file.
        </p>
      ) : null}

      {step === 'idle' ? (
        <>
          <div {...getRootProps()} className={'rb-dropzone' + (isDragActive ? ' is-active' : '')}>
            <input {...getInputProps()} />
            Drop a photo here or browse (JPEG / PNG · max 2 MB). Square or portrait cropping.
          </div>
          {value ? (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                alt="Profile thumbnail"
                src={value}
                width={72}
                height={90}
                style={{ objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
              />
              <button type="button" className="rb-btn rb-btn-secondary" onClick={() => onChange('')}>
                Remove photo
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div role="dialog" aria-label="Crop photo">
          <p className="rb-muted" style={{ marginBottom: 8 }}>
            Drag the handles, then confirm. Aspect ratio presets do not discard pixels until you confirm.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => setAspect(1)}>
              1∶1 square
            </button>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => setAspect(4 / 5)}>
              4∶5 portrait
            </button>
            <button type="button" className="rb-btn rb-btn-secondary" onClick={() => setAspect(undefined)}>
              Free
            </button>
          </div>
          {!!imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c: PixelCrop) => setCompletedCrop(c)}
              aspect={aspect}
            >
              <img ref={imgRef} alt="Crop target" src={imgSrc} onLoad={onImageLoad} style={{ maxWidth: '100%', height: 'auto', maxHeight: 420 }} />
            </ReactCrop>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="rb-btn rb-btn-primary" onClick={() => void finishCrop()} disabled={!completedCrop}>
              Apply &amp; optimize
            </button>
            <button
              type="button"
              className="rb-btn rb-btn-secondary"
              onClick={() => {
                setImgSrc('');
                setStep('idle');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
