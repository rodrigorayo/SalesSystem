const fs = require('fs');

let upload = fs.readFileSync('backend/app/api/v1/endpoints/upload.py', 'utf8');
upload = upload.replace(/<<<<<<< HEAD\r?\nimport traceback\r?\nfrom fastapi import APIRouter, UploadFile, File, Form, HTTPException\r?\nfrom app.services.import_service import procesar_archivo\r?\n=======\r?\nfrom fastapi import APIRouter, UploadFile, File, HTTPException\r?\nimport shutil\r?\nimport os\r?\nimport uuid\r?\n\r?\nfrom app.infrastructure.core.config import settings\r?\n>>>>>>> origin\/main/, `import traceback\nimport shutil\nimport os\nimport uuid\nfrom fastapi import APIRouter, UploadFile, File, Form, HTTPException\nfrom app.infrastructure.core.config import settings\nfrom app.services.import_service import procesar_archivo`);
fs.writeFileSync('backend/app/api/v1/endpoints/upload.py', upload);

let router = fs.readFileSync('backend/app/api/v1/router.py', 'utf8');
router = router.replace(/<<<<<<< HEAD\r?\n    price_requests, clientes, price_lists, reports,\r?\n    chat\r?\n=======\r?\n    price_requests, clientes, price_lists, reports, creditos, b2b,\r?\n    comunidad, traslados\r?\n>>>>>>> origin\/main/, `    price_requests, clientes, price_lists, reports, creditos, b2b,\n    comunidad, traslados, chat, analytics`);
router = router.replace(/<<<<<<< HEAD\r?\napi_router.include_router\(analytics.router, prefix="\/analytics", tags=\["analytics"\]\)\r?\napi_router.include_router\(chat.router, prefix="\/chat", tags=\["chat"\]\)\r?\n=======\r?\napi_router.include_router\(b2b.router, prefix="\/b2b", tags=\["b2b"\]\)\r?\napi_router.include_router\(comunidad.router, prefix="\/comunidad", tags=\["comunidad"\]\)\r?\napi_router.include_router\(traslados.router, prefix="\/traslados", tags=\["traslados"\]\)\r?\n>>>>>>> origin\/main/, `api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])\napi_router.include_router(chat.router, prefix="/chat", tags=["chat"])\napi_router.include_router(b2b.router, prefix="/b2b", tags=["b2b"])\napi_router.include_router(comunidad.router, prefix="/comunidad", tags=["comunidad"])\napi_router.include_router(traslados.router, prefix="/traslados", tags=["traslados"])`);
fs.writeFileSync('backend/app/api/v1/router.py', router);

let reqs = fs.readFileSync('backend/requirements.txt', 'utf8');
reqs = reqs.replace(/<<<<<<< HEAD\r?\nscikit-learn\r?\nholidays\r?\nopenmeteo-requests\r?\nrequests-cache\r?\nretry-requests\r?\nlangchain-google-genai\r?\nlangchain-experimental\r?\n=======\r?\nslowapi\r?\nhttpx\r?\n>>>>>>> origin\/main/, `scikit-learn\nholidays\nopenmeteo-requests\nrequests-cache\nretry-requests\nlangchain-google-genai\nlangchain-experimental\nslowapi\nhttpx`);
fs.writeFileSync('backend/requirements.txt', reqs);

let client = fs.readFileSync('frontend/src/api/client.ts', 'utf8');
client = client.replace(/<<<<<<< HEAD\r?\nconst FALLBACK_URL = isProductionUrl[ \t]*\r?\n[ \t]*\? 'https:\/\/sales-system-kappa.vercel.app\/api\/v1'[ \t]*\r?\n[ \t]*: 'http:\/\/127.0.0.1:8000\/api\/v1';\r?\n=======\r?\nconst FALLBACK_URL = isProductionUrl\r?\n    \? 'https:\/\/sales-system-kappa.vercel.app\/api\/v1'\r?\n    : 'http:\/\/localhost:8000\/api\/v1';\r?\n>>>>>>> origin\/main/, `const FALLBACK_URL = isProductionUrl\n    ? 'https://sales-system-kappa.vercel.app/api/v1'\n    : 'http://localhost:8000/api/v1';`);
fs.writeFileSync('frontend/src/api/client.ts', client);

let api = fs.readFileSync('frontend/src/api/api.ts', 'utf8');
api = api.replace(/<<<<<<< HEAD\r?\nexport \* from '\.\/analytics';\r?\n=======\r?\nexport \* from '\.\/b2b';\r?\nexport \* from '\.\/comunidad';\r?\nexport \* from '\.\/traslados';\r?\n>>>>>>> origin\/main/, `export * from './analytics';\nexport * from './b2b';\nexport * from './comunidad';\nexport * from './traslados';`);
fs.writeFileSync('frontend/src/api/api.ts', api);

let appTsx = fs.readFileSync('frontend/src/App.tsx', 'utf8');
appTsx = appTsx.replace(/<<<<<<< HEAD\r?\nimport DashboardMaestro from '\.\/pages\/DashboardMaestro';\r?\n=======\r?\nimport ComunidadPage from '\.\/pages\/Comunidad';\r?\nimport MermaDashboard from '\.\/pages\/MermaDashboard';\r?\nimport TrasladosPage from '\.\/pages\/Traslados';\r?\n>>>>>>> origin\/main/, `import DashboardMaestro from './pages/DashboardMaestro';\nimport ComunidadPage from './pages/Comunidad';\nimport MermaDashboard from './pages/MermaDashboard';\nimport TrasladosPage from './pages/Traslados';`);
appTsx = appTsx.replace(/<<<<<<< HEAD\r?\n[ \t]*<Route path="\/dashboard" element={<DashboardMaestro \/>} \/>\r?\n=======\r?\n[ \t]*<Route path="\/comunidad" element={<ComunidadPage \/>} \/>\r?\n[ \t]*<Route path="\/b2b\/mermas" element={<MermaDashboard \/>} \/>\r?\n[ \t]*<Route path="\/traslados" element={<TrasladosPage \/>} \/>\r?\n>>>>>>> origin\/main/, `          <Route path="/dashboard" element={<DashboardMaestro />} />\n          <Route path="/comunidad" element={<ComunidadPage />} />\n          <Route path="/b2b/mermas" element={<MermaDashboard />} />\n          <Route path="/traslados" element={<TrasladosPage />} />`);
fs.writeFileSync('frontend/src/App.tsx', appTsx);
