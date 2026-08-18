import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { ShieldAlert, ShieldCheck, Camera, XCircle, User as UserIcon, Building2, Briefcase } from 'lucide-react';
import axios from 'axios';

interface VerificationData {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  branch: string;
  isActive: boolean;
  photoPath: string;
}

export const GuardScanner: React.FC = () => {
  const [scanResult, setScanResult] = useState<VerificationData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    if (!isScanning) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 }, 
        aspectRatio: 1.0,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        videoConstraints: { facingMode: { ideal: "environment" } }
      },
      false
    );

    const onScanSuccess = async (decodedText: string) => {
      // The decoded text should be the full URL, e.g. http://domain.com/verify/UUID
      // We want to extract the UUID from the URL.
      try {
        const url = new URL(decodedText);
        const pathSegments = url.pathname.split('/');
        const verificationId = pathSegments[pathSegments.length - 1];

        // Stop scanning while we process
        scanner.clear();
        setIsScanning(false);
        setScanError(null);

        // Call the API directly securely, completely ignoring the host of the scanned URL.
        const response = await axios.get(`/api/Employees/${verificationId}/public-verify`);
        setScanResult(response.data);

      } catch (err: any) {
        scanner.clear();
        setIsScanning(false);
        if (err.response?.status === 404) {
           setScanError("Badge Not Found: The scanned ID is not in our system.");
        } else if (err instanceof TypeError) {
           // URL parsing failed
           setScanError("Invalid QR Code: Not a valid HRDesk ID badge.");
        } else {
           setScanError("Verification Failed: Network error or server offline.");
        }
      }
    };

    const onScanFailure = (error: any) => {
      // Ignore normal scan failures (happens every frame it doesn't see a code)
    };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch(e => console.error("Failed to clear scanner", e));
    };
  }, [isScanning]);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center">
          <h1 className="text-2xl font-black uppercase tracking-wider flex items-center justify-center gap-3">
            <Camera size={28} className="text-blue-400" />
            Security Scanner
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Scan HRDesk Employee Badges</p>
        </div>

        <div className="p-6 md:p-10 bg-slate-50 min-h-[400px] flex flex-col items-center justify-center">
          
          {isScanning && (
            <div className="w-full max-w-sm mx-auto">
              <div id="qr-reader" className="overflow-hidden rounded-2xl shadow-inner bg-black border-4 border-slate-200"></div>
              <p className="text-center text-slate-500 text-sm mt-6 font-medium">Point camera at the employee's QR Code</p>
            </div>
          )}

          {!isScanning && scanError && (
            <div className="text-center w-full max-w-md animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert size={48} className="text-red-600" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3">SECURITY ALERT</h2>
              <p className="text-red-600 font-bold mb-8 bg-red-50 p-4 rounded-xl border border-red-100">{scanError}</p>
              <button 
                onClick={() => { setScanError(null); setIsScanning(true); }}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors w-full"
              >
                Scan Another Badge
              </button>
            </div>
          )}

          {!isScanning && scanResult && (
            <div className="w-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className={`rounded-2xl overflow-hidden shadow-lg border-2 ${scanResult.isActive ? 'border-green-500' : 'border-red-500'}`}>
                <div className={`p-4 text-center text-white ${scanResult.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
                  <div className="flex justify-center mb-2">
                    {scanResult.isActive ? <ShieldCheck size={40} /> : <XCircle size={40} />}
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-widest">{scanResult.isActive ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</h2>
                </div>
                
                <div className="bg-white p-6 flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-inner bg-slate-100 mb-4 shrink-0 flex items-center justify-center relative">
                    {scanResult.photoPath ? (
                      <img 
                        src={scanResult.photoPath} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <UserIcon size={56} className={`text-slate-300 ${scanResult.photoPath ? 'hidden' : ''} absolute`} />
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 mb-1">{scanResult.employeeName}</h3>
                  <p className="text-sm font-bold text-slate-500 mb-6">{scanResult.employeeCode}</p>

                  <div className="w-full space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-3">
                      <Briefcase size={18} className="text-slate-400" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-900 truncate">{scanResult.designation || 'N/A'}</p>
                        <p className="text-xs text-slate-500 truncate">{scanResult.department || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-3">
                      <Building2 size={18} className="text-slate-400" />
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-900 truncate">{scanResult.branch || 'Head Office'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setScanResult(null); setIsScanning(true); }}
                className="mt-6 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors w-full flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                Next Scan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
