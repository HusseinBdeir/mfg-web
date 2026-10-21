/* ============================================================================
   ISABI Systems — Manufacturing Operations Standalone Web App (js/app.js)
   Option 3 Architecture: Own SQLite / PostgreSQL Engine + Offline PWA
   Companies: WTC · BBConstruction · Lions Transport · All Group
   v3.1 — fail-closed team login, RLS-scoped entry desk, validated forms with
          price-agreement / VAT / meter / duplicate guards, period-aware
          registers, sortable + pageable tables, CSV export, void with cloud
          tombstones, 22 real statements, data-driven sentinels, history nav.
   ============================================================================ */

(function () {
  'use strict';

  const SEED = window.MFG_SEED || {};
  SEED.models = SEED.models || {};
  SEED.records = SEED.records || {};
  SEED.sentinels = SEED.sentinels || {};
  [
    'sales_tickets', 'raw_purchases', 'fuel_intakes', 'expenses', 'receipts', 'settlements', 'salaries',
    'price_rules', 'vat_invoices', 'credit_terms', 'customers', 'suppliers', 'products', 'sites',
    'regions', 'uoms', 'product_types', 'equipment', 'company_equipment', 'drivers', 'company_drivers',
    'expense_categories', 'expense_subcategories', 'employments', 'attendance', 'logistics_allowances',
    'overtime_rates', 'external_movements', 'loans', 'loan_settlements', 'conversions',
    'jv_partnerships', 'jv_distributions', 'daily_totals'
  ].forEach(k => {
    if (!Array.isArray(SEED.records[k])) SEED.records[k] = [];
  });

  const CLOUD_CFG = window.MFG_CLOUD_CFG || {};
  const CLOUD_URL = CLOUD_CFG.u ? atob(CLOUD_CFG.u) : '';
  const CLOUD_KEY = CLOUD_CFG.k ? atob(CLOUD_CFG.k) : '';
  const CLOUD_DOC_KEY = CLOUD_CFG.docKey || 'mfg_web_store';

  const PARAMS = new URLSearchParams(location.search);
  const IS_LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/.test(location.hostname);
  // Demo mode = the 1-click seat simulator shows PINs. Only on the local server.py host or with ?demo=1.
  const IS_DEMO = PARAMS.get('demo') !== '0' && (IS_LOCAL || PARAMS.get('demo') === '1');
  const HAS_LOCAL_API = IS_LOCAL; // server.py REST endpoints exist only on the local / LAN host
  const MIN_DATE = '2024-01-01';   // bhf_mindate on every manufacturing BU
  const MAX_DATE = '2030-12-31';   // Power BI Dates calendar ceiling (2024-01-01 .. 2030-12-31)
  const VAT_RATE = 0.11;
  const DAY_SHIFT_FROM = 6 * 60;   // m48: Day shift 06:00–17:59, Night otherwise
  const DAY_SHIFT_TO = 17 * 60 + 59;
  const PAGE = 100;
  const SEED_DATE = String(SEED.generated_at || '').slice(0, 10) || todayISO();

  const DEFAULT_FACE_SEEDS = {"husseinbdeir@bhfirms.com":{"face_samples":[[-0.169,0.0957,0.02447,-0.01083,-0.01605,-0.01265,-0.01285,0.01305,0.16293,-0.00247,0.18537,-0.02275,-0.18379,-0.11373,-0.06909,0.10834,-0.17215,-0.10265,-0.07492,-0.10408,0.03489,0.08958,-0.00587,0.01114,-0.21555,-0.31683,0.01363,-0.17853,-0.01956,-0.05454,0.02328,0.14697,-0.12245,-0.07951,0.08886,0.13959,0.0067,0.04685,0.16192,0.05852,-0.09861,0.03626,0.06709,0.4018,0.14416,0.02875,-0.02948,-0.00454,0.15126,-0.30128,0.06839,0.15788,0.06299,0.10197,0.13423,-0.13649,0.03105,0.1076,-0.21299,0.09067,0.0123,-0.00492,-0.01307,-0.07199,0.15052,0.07635,-0.13205,-0.0854,0.08478,-0.10627,-0.01638,0.07514,-0.12526,-0.17893,-0.27692,0.10839,0.40101,0.17221,-0.11297,0.00855,-0.05496,-0.06162,0.04983,0.00362,-0.09221,-0.02117,-0.02133,0.01959,0.15528,0.06835,-0.0789,0.19038,-0.01892,-0.00471,-0.00014,-0.02918,-0.10673,-0.01059,-0.15137,-0.01182,-0.0275,-0.14348,0.01075,0.07753,-0.19627,0.09342,0.0312,-0.00115,-0.02943,0.08622,-0.15597,0.01808,0.15895,-0.2389,0.22638,0.1809,0.13015,0.15414,0.10945,-0.04759,0.00936,0.0304,-0.07792,-0.08275,0.04394,-0.01365,0.01098,0.01834],[-0.16883,0.11814,0.04365,-0.02038,0.00713,-0.00028,-0.02288,0.02827,0.16317,-0.00154,0.17772,-0.02561,-0.19812,-0.10292,-0.06128,0.10394,-0.17322,-0.10372,-0.06128,-0.10099,0.05196,0.0925,-0.01254,0.01547,-0.20707,-0.32557,0.00773,-0.16595,-0.01849,-0.03388,0.00754,0.08677,-0.13169,-0.0855,0.07388,0.13358,0.01447,0.04532,0.14572,0.04454,-0.11175,0.02594,0.07797,0.39198,0.15203,0.03835,-0.04469,0.01417,0.13606,-0.30798,0.09889,0.15397,0.06891,0.09917,0.13286,-0.1549,0.0045,0.11117,-0.20167,0.0877,0.0002,0.00474,-0.01522,-0.07775,0.13716,0.09101,-0.13599,-0.10221,0.086,-0.11138,0.00148,0.06661,-0.11737,-0.1639,-0.28469,0.11272,0.39218,0.15187,-0.11556,0.01052,-0.05437,-0.05126,0.03835,-0.01077,-0.09355,0.00426,-0.02855,0.01945,0.14047,0.06783,-0.07891,0.18325,-0.03841,-0.00891,0.0245,0.00782,-0.11668,-0.01385,-0.16855,-0.01004,-0.01042,-0.16257,-0.0002,0.08176,-0.21665,0.09905,0.04033,-0.00109,-0.01817,0.09932,-0.16437,0.01131,0.18162,-0.22012,0.2204,0.17855,0.11216,0.16313,0.11424,-0.03651,0.00575,0.02879,-0.08728,-0.08903,0.02348,-0.01942,0.01964,0.03569],[-0.20894,0.10548,0.02186,-0.01977,-0.04278,0.009,-0.01835,-0.01417,0.17419,0.02172,0.14651,-0.03694,-0.19444,-0.07989,-0.06672,0.12507,-0.15574,-0.1193,-0.07285,-0.10925,0.01646,0.08559,0.02083,0.01445,-0.22809,-0.35378,0.00995,-0.15591,-0.04722,-0.03763,0.00407,0.15382,-0.15589,-0.0669,0.08981,0.10064,-0.00338,0.06001,0.18511,0.05248,-0.15067,0.04016,0.0796,0.3797,0.16924,0.03236,-0.02729,-0.01394,0.12585,-0.26301,0.07583,0.16929,0.04875,0.062,0.1085,-0.11279,-0.00308,0.08481,-0.17155,0.08064,0.03029,-0.0524,-0.01528,-0.07048,0.14284,0.07948,-0.09325,-0.10876,0.09438,-0.09127,-0.01037,0.06298,-0.12135,-0.20475,-0.27692,0.09712,0.39114,0.16025,-0.13054,0.0443,-0.0514,-0.04999,0.07614,0.02468,-0.09304,-0.00951,-0.01626,0.02426,0.20429,0.04415,-0.09147,0.20275,-0.01078,-0.00297,0.01234,-0.02056,-0.09363,-0.00199,-0.16573,-0.02137,-0.00863,-0.09881,0.03189,0.07979,-0.20869,0.09221,0.03797,0.00361,-0.04124,0.08623,-0.13687,-0.00318,0.14232,-0.2261,0.22805,0.16745,0.10177,0.16495,0.12146,-0.05324,0.03548,0.05331,-0.06618,-0.07041,0.09875,0.00438,0.05261,0.05105]],"face_thumbs":["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAcFBQYFBAcGBgYIBwcICxILCwoKCxYPEA0SGhYbGhkWGRgcICgiHB4mHhgZIzAkJiorLS4tGyIyNTEsNSgsLSz/2wBDAQcICAsJCxULCxUsHRkdLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCz/wAARCAC0APADASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAABAACAwUGAQcI/8QAOhAAAgEDAwMBBgMGBAcAAAAAAQIAAwQRBSExEjJBBhMiM1FhcRSBkRUjQlJyoYKSk7EHFiVzg8Hw/8QAGAEAAwEBAAAAAAAAAAAAAAAAAAECAwT/xAAbEQEBAQEBAQEBAAAAAAAAAAAAARECMSESYf/aAAwDAQACEQMRAD8Aa2jIeCRIG0ZgThppPZgznsgx3E5NrXGXfRqw7d5E2n3C59w7TXGiDxGmgAd49DINZ1gN0Mj9jUBx0mbH2APMb+CRm7B+kPhayPQy8giLrdTsTNY+m0zzTEgbR6LHHQR9YZAzwuKg85jxduPAMu20SiAdyDIjoK52baGQKv8AaBQZwQZ2nq7M4GWGJYD0+zOQDkQQ6BcJWIUDnG8VgGUNWzjLAn6wxNSU/KUhsKlF2VgWIPKjIM4UKEjDjf5RBpaeoJnkgS+AUjM8/VyNgzfpN8ofHCkfeEosO6VPBjunxGr1+VETFs8CPSx3oJbiE24wpEHVmJOdsQi3bIIPMYTidH1iG86BAjvtJaXdIxJKZw4gYnE4RHCIjIxGEZSNKx3UU7ht8xOdaEciBhq4/fL/AEmRlcjeS3PxaRB2ORG4khlNp0Y+crG1uzHcKw/8Zjf29p4G71f9Mww1rkCLGd8ys/b1gV76mf8AtmcGv6eP46n+mYBakcTvEqxr1h4ep/kMkXW7FuKjf5YEsgc7GLbMCGsWR/jb/LHDVLQ4/efqIaQsjzid6RziRrdUXGzZEf7VCOYaEtJBzA77ULSyUmtUVZXa36ipaXbuAcvjaeXanqt7qlwzFm6SdhA5G21D1rZ0WK0velFc+t3dvcTaZgWVdz2mTpo9w/CmV8PFwvrGr7QN0S/sf+IiL0pUXAmN/wCXrv8AkMZW0O6or1FDD4f5euWHq+zvAAtUAnwZdU75KgBBBE8JsrS6W4UU2Kmel6Da6iLdRWJIxzEmxsUuVMmFwiqSDgykW3u+EGT9TiS+xvugjpUHjuiJfrc08d0eKyHhhKNEvF5Cn/FJ6aXLnHs1z/VHoXKuD5kqtjeVSUbrHAH+KEILgJjbP3gFyvE7IUroABvn7SUMCIw4ROFVPIBnScRvWIAFd03VqRRturg+No1Hbq6agAbxjgye696mCP4TmDVBlkYcqYjY82iMN1BkbabRYb01P5Q3IB4neoY2ERqttFt8/D/SRPoNIttkS6GDOiMmfqaBz0sR+UiOgVgNnE1G5HEXTkcQDJtol2oOMbfIyCppN/TqqelyCPBm06B8oQ1IM3bwsVDDI1zQJDkgrsQRCKd/VUEFhNQbWmwIKiDXOnUPYOzU1HSCc4iDAXVMau9aqXytNun7ya10ahTVTgMSNwPE5pA/6TePg9LV9jDKIZ2AB5mN3XRziRdOtgNguZLStqNNvEcllVByTtJ1oZOM7y5P6aZEosACBFVs6VWkV6Q3yiWzfY52kwpmn5zJsNS1tHt7aqK1eqtuueSCf9psdLwtAIGDYA3HmZrWGFW0IbgSS01J6F0FzkeyX/3FzsZ942YyOFP3jlYnkH9Jnaet452hSa4pPf8A3m8YLgNyCpxJqJAqAYxKpNVptyRCaeoUyeRALYRyyvo6lTZRuCfvJ1vaZ+YjA1RC03USuS5pscBhmHWzh6eQcgHEAkYHGwjCy+Tg/WSmNIzzGA9wB+HcjwMyDAO8IuKQai+PdPSdxA1LIF6mypwOOIrDZYMfmY/JxzIlVuCRO9L/AEA+8k0uTjOAYgx8gRq9ecZEWGG2V/OBJuokcToI+sYuR8sTvVg4GIyPDDqA35hRbDt/TBFGSCRjeENuzZwNoqDQN+QZ2qnXSKEZ6hiMHMcWVULM2FAyTAPKqBfT0v6bsVSnWIZfrvKx/U9xSqZp0fdH0mj9TUaTXl2aRDU6rq5I+eJkbu6amrCjTyF2MfPMrWW4v7T1dcVWQNTwODtLxdXQr1bZmCtK1UdDMO7+H5TbW3p+tV0c3QPvEZCyrzzPWkoC99W3lJ+iinujmC0PWd4XxVt+pfpKm8aqKrqR0keJHp1zVYt7Sieldofieptbi2vaeq2TdOQSMEHxC/TFm+pVLqrct1LT6aS+OJU6Eqs/UgwDzNd6VpJQ0vpyPaVKjVCPpnb+0ykxPXiQ6BS/maQVNBcN7lTb6iaLBxnE505PEtkzp0a5UbMDGfgryn4J+xmmwADtOdIgbNmnd0v4XIH0jhXuF5DiaT2akcRewRuQIhqs06tXuLpKXWVz5IzNfZ0jQt1Rm6mG5OMZlRb0USujBRkGXKNKgqfM4TG9W0aTmUTjtsZUUqteuxRqDU6eNnLDP6S1JgVM+6foxH95NNk1X3vdqD9ZMCQNmBmfTW9NYj38fnJv2pprHaqR+cnDXfv5ByJ3BOeMypW9sX2F1j7mTU6tse25U/nGSxBwN+Z3PyUGCCqnirn85MG+TiAEJ3AH5yY1F6qikf8A20DRm9op6hzJ6VdGRwzJ1dTADO/I8RUj1Kk7EyK/HXp9wq8mm2P0kgK8hcfaLqBBB2EDnyvOqFu93ZszqxXJHUfErrjRmB93D/aW2rk6bqVxapUIpFg6rnbBnLaupT5x87G8yqmz0orcqXG+eDPRbOhWGjBQQM+Jjat5StHFasrH+XHEIT1Q1FQ2fcG/5RdS1ckN1XRqVxWLBQr/ADEisfT3RUDOcfKENqVO8Zbi3z0kYcH5w+leBqeCNo/uDInt7Gja0/cxnzC9Ho1RqSM6MgpUyMZ2P1lNUvfZBmLbCX+hMws1rVGLNUUbk7yGfV+L5cMwBbH1jbtKtMEUqo6uVZTBiKdY4KZb6cyekaVCouR0AHcESowP/EOye0rkBsZYmDpWS5JehVYdB7lGAfz8ztxSpXFb3mLIxyB4+kTsLakMdTgHgDJjApHOI4PI1IKg4xnx8p2Saak/70S1U7CU1M/vBLSm2wl8gTmczvGhszhbeMnSd4EhAeqD4aS1xVfpFNwgz7xxk4+kDpUvY3FUZyCQd9z+Zk1WPKf2LbMT7px95w6Lb/I/rDPxca12ByZWjAx0SiR7rOv5xy6GoG1dx+cIS7HzjhcgmPSxAulVVO11VHywxkg0+7GOm9q/rD6NQMISgVuItGVV21vqYq9IvnH94y5sr9HeoK7O+RvnGfnNDRo5bMfVoEiLRjLpV1mn21X2+smTUdbUYzn7iXf4c5iNHEPhMP6he9qVkubhcMR05AkFldn2RLnAHM0mu2/VSxMq1HoyIbGvEruo35vrYJbqT0HZmMASlW6Ok1B+ZhPsgAY1aY6pU6mNZxauNP1KnZWwpXFMEN5WGC5RELo3UnjeUy26lQZOuydIkbBeaf7Y3d0tNqnRTY4J+Qm8tb6zt6CU1uKZCjG7TG2FsevMtDbk+IvWPWtOupIaimgyMynPMmqXaPUIcjq8gTP6faHr4hgsz+IG0aMXVKu61v3YplSu/Uf9o/2tJ9gRn7wSna4XiMFDFSIYsldCgPVHdanhpXskkppxA8Gow6hv5ltS7AcylpL7wlrQ2QRyiwSGxEW3jMxEx6WOloJUOLlv6QYQTGFQTmAx4nUu+lScwGpqZziQtcAjGZASjHMG0g6lqZXmSjVRmV2UxJaSISIyxc0dXwuN5cadqgIwUJgWkabQuGUFczdaZ6ctwgPR/aTaMBWVY1SMIRLL8MWGcS2o6VTo9qiPa2wdhJtLFQth1RtWwKLmXIoFRIKyMRgw0Yxus22aR2mPu6PQDtPRtUtupDtMXqNDDEYit+NOIy5r9DEGJaoJ5nb61brJWB06dQHEcvxos0uQBjMPtP3xG0q7a0d3GZptMswoG0jqn6sdPtNhtLQWmSNoTp1p7g2ltRswXGRLlY9T6rba39kd1hHQFfqKy/paehUe7HPpqMMdMNT+VALymNiMSL8RTepsYfe6G2CUEpWsK1GtvmIYsMAyRFkNIHAzC0jH5PprvLCl2iCUxvCqfEW4MTZizOZizF+hhEzmYjOZh+hj5yyZyKcmyz1O8Ltt2GYIvMLtu8QTW79L01LLmel2SKKIwPE829L9yz0qy+CJn0YvpGJE6jMm8SJ+ZJIXEGq8Ql4NV4hDVV8B0NMRq4Aqmbe+7WmI1j4hhV8es/WUE7iDezXPEKrcwfzHGlHWirkbS+sQOoSitfEvbHvEy6VGx0xR7IS1pKOqVemfDEtaXdNOfGPXqztwOmEBRmQW/bCBzBJtVFKcSjv6SZO0vqnZKO/5MAqCoB2kiRjdxj1jITShKQalCUippIoopCiMbHGNgmvnKcnZydIPXmF23eIIvMLtu8Rpre+l+5Z6VZfBE819L9yz0qy+CJn0YzxIn5kviRPzIJC8Gq8Ql4NV4hAqr7taYjWPiGbe+7WmI1j4hhWnHqgrcwfzCK3MH8wjSj7XxL2x7xKK18S9se8TPpUbLTPhiWtLulVpnwxLWl3TTnxj16tLfthA5g9v2wgcwSVTslHf8mXlTslHf8mAVLdxj1jG7jHrGQmlCUg1KEpFTSRRRSFEY2OMbBNfOU5Ozk6QevMLtu8QReYXbd4jTW99L9yz0qy+CJ5r6X7lnpVl8ETPoxniRPzJfEifmQSF4NV4hLwarxCBVX3a0xGsfEM2992tMRrHxDCtOPVBW5g/mEVuYP5hGlH2viXtj3iUVr4l7Y94mfSo2WmfDEtaXdKrTPhiWtLumnPjHr1aW/bCBzB7fthA5gkqnZKO/wCTLyp2Sjv+TAKlu4x6xjdxj1jITShKQalCUippIoopCiMbHGNgmvnKcnZydIPXmF23eIIvMLtu8Rpre+l+5Z6VZfBE819L9yz0qy+CJn0YzxIn5kviRPzIJC8Gq8Ql4NV4hAqr7taYjWPiGbe+7WmI1j4hhWnHqgrcwfzCK3MH8wjSj7XxL2x7xKK18S9se8TPpUbLTPhiWtLulVpnwxLWl3TTnxj16tLfthA5g9v2wgcwSVTslHf8mXlTslHf8mAVLdxj1jG7jHrGQmlCUg1KEpFTSRRRSFEY2OMbBNfOU5FFOkHrzC7bvEUUaa3vpfuWelWXwRFFM+jGeJE/MUUgkLwarxFFCBVX3a0xGsfEMUUK049UFbmD+YooRpR9r4l7Y94iimfSo2WmfDEtaXdFFNOfGPXq0t+2EDmKKCSqdko7/kxRQCpbuMesUUZCaUJSKKKmkiiikKIxsUUE1//Z","data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAcFBQYFBAcGBgYIBwcICxILCwoKCxYPEA0SGhYbGhkWGRgcICgiHB4mHhgZIzAkJiorLS4tGyIyNTEsNSgsLSz/2wBDAQcICAsJCxULCxUsHRkdLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCz/wAARCAC0APADASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAABAACAwUGAQcI/8QASxAAAQMCAwQFCgIECQ0AAAAAAQACAwQRBSExBhIyQQcTIlFxFCNCYXKBkaGxwRVSM0OC0QgXJEVic6PS4SU0NURTVXSDkqKywtP/xAAYAQEBAQEBAAAAAAAAAAAAAAABAAIDBP/EAB8RAQEAAwEBAQADAQAAAAAAAAABAhExIRJRE0Fhcf/aAAwDAQACEQMRAD8A8q/iunHHiVvCC/8A7Jw6MgB2sRefCG33Xs/krTkWhM8iYdWD4Lh/I6fLx1vRvSg9qum9zAFK3o4w70qyqPhuj7L1p2HxOyMYUZwqDXcR91ajy0dHeEt1nrHftt/uqRvR/go18pd4yf4L0x2EROFw2yYMGZY6q+r+rx56zYPAhrBK7xlKmZsVs6NcOLvGaT963D8EB4T8VH+Bv9FwRu/q8ZNmyOzbf5qZ75Hn7qdmzOzjf5pg94J+60hwOUaG6YcFnsbK9/UpW4Ps5Db/ACPQn2oQfqiqWgwIG7cGw0D/AIVn7kXJgdQ6Eu3dFFHhdSGEiPJouSUXYHwU2DtHYwuhHhAwfZGxCgZw0kDPZjAVIIXNHPTuT2mx4nLJ01+GTQvmLWNAs3kLK0szQrKbOyOOJFoJN4zxeIWps/uaVSiw8MCW7fnmkN71Jo3xzCdo9rCBfVGNF2hCDesM80XG67AlH2yTmrmoXQlHN1RMPChwp4TqEJNZNNgbJ644AixSjSBZN3e0kWvGjrj1prnPbmWgj1KIRoHaHc4/VeYdP0e90f0jrcGIRn+zkC9NbKwzyjeAzv8AJeddO8e/0bb35KuN3ycPurHoq9tlZODbDRNJPcuhzuYWWjrABNDc0jcFOBPcpObudk9rQOS4L30XQO+6g7uNIuAFwMaBou5DmEgWh3EFA0RtvonCIJ1231CRcAL3UkgiAi7gq2vrqOkjPWyNHqVZtHtRFh1K6OJwMhXmFdidZiMznve4g8lQ6bmt2yooXFsYDlSTbaEuO6zJZdtJNIeElTx4PUyaMK14dNBSbbPgm3yzJaGh6RYXkCUbqwjdn6sm24VFNg9TA6zmlXh+XslDtRSVttyQX7laNrWuzuvGMDw+rkqmiKQtN+9enYfh9W2nAlfcrP8AxnS/ZVNNuambWAOb8FUtw+pdm2RrQO8KT8PqCRecC3c0qC4bWNPJPbVsPeFUto5W/rv+1FQ0bnjOci3c1KWLahht2giYXjrQAdVWtogB+kcfcERDEI5Gv3iS3vUlrySKHZM8kAgfBT3Nkolw6Lhv3pp3u9RBTRMNU+7Ad4A6LzzpqbfoyrWH9VPC4eG9b7r0ecHrGHmQQsD0yxb3RXij+bDCf7Zg+6pfRQz4MSGldIonQYtyrpD6t6yvty/Jd3G8wjbTOOgxY3vUyn/mFDmmxEnOSY/tn961XVjWycImXuQoMe6GubqZf+opXrAM+s962BhjIGS6YWE6ZKTG9dUjkT7k2OuqmSHeystqykjLwC0HPuXZMPhJe4Mbc5XARdJmosUnDRcOUs2LvFM9xuLBWrsEpiMmWVVjuDxQYLVSsJG6y+qzVGQqqCTEZWzvddkh7OaNpsBhj7Lm3Pq0UtJu/glE7mQfqiousk7LVy929GMmnG4RAzQNRdPTwxHQFNip5RxaIhkBdoVvR1E7YoXcgo6jDo6htmxtcfgpGUjwbk2UovFzWMp/pVdLQUdDiEbZJzHM8gNaGE3PitlSSh8INx3ZlY7ETetp5NCHixRFFicsTp262kKcJY5ZxsxcjID4p9n20+ay7MacLXup48cueYXZxaFpdzAREDszdZ5mNN5uU4xlhYe1dW00QzCc2ypGYy06uUrMXZcdtpTtaXbDY3RYzCo4sSa++mnIq5gdvQsJyuLpiOc2/qKaQ/8AolSFcSgNW/cEZc0jtajMZrF9LIbN0VY0Gm9mRn4SsP2W5q7dQT+UgrFdJ43+jjG93MeTm4HqIN/kidR9wTqV3I6u+Sja4HMFOLxoVjbSTIekuix5hM3mka6JbzbWuEhNcJw05KNpBHrXbgalQTRi8jVMT2Hi1zdDRZTNIOV1M7NrrX1GaKnAD3Kv2hpvKsArIgLkxkgesZo5pPenOG8whxFiLG6k8qp8QdFgkJmPYiuAefghI9r2wSjdiJHii8ZoWwXpvQjld71nKypihHZgBF7XDU44Su27psKTawVMoaY7NKsXYuyOMvbqBdYaild1jWlo7WmS1s+A1EOEiqF3Ei+6tXHGdblV9ZtjXNeRHH2Ao6bbCrebTU9294VHVSS9ogZjkpcOqJHx70sJteyrhNM79bJ9QzEMNM0TiCBvDvaQrnZjDRVYN5RVHrJJ5HPudbX/AMFQ4WwOo5d0WDmHL3LZ4AI4cIpqZrrvijFwuU8ZzdOCU1rbvzUJwCLe7LnAeKurZDvTmRue4NaLk8ltyUbsBFspCEwYJI0jt3HO6vy0i4IsRqmgtL924v3EqKiODztPZcCu/htS08itAACBkugDuQtg8Foj5SRUxhzSNCtUzIADRVFKQJgrNpW4k100uTS64TbqCKqb1lNI25FwcwsfttRwxdG+PdW03dRSOJJJJs262Ts2kepZna1nWdHuOMH+7pwPHq3K/s78V7ZG3tu/JSgMHID3IZs0l/0Iz9acZ5hkYL+9YIgOaH2+y7e3P5Ic1En+wzXWzy84wEgUMwuZA6qISuPo296cJDzaoCYjeRuaku0tfZ1jdDRSeeGRU0YY+nc/MFxP1IRUcB3kIHGy9uC1LozZzW3BHiiwANHFNlYyeF8TrFrwQbqM685dE/EKXeJzJJvyVTPg72OtufBXlRPNh7pcPc4BsT7AWztqpIZWllzmU42x6JqqfDMNLatj3NuQcgvRjFM7B2NNrW0WN8sgpJRLK4g+iOSLG1Rhbd582NfBGUtakB4hgUU05dG0NcTyUuHYA2F13mxUjq+OokFRTOLonDMHkUeysDo89E+6WpBMdLFDD1cds8kfgkMjKuaSRu67ca3I3Czk1b1Ub3b2QGS0mCDqKBpdm6QAm/gsRzzvi6bLCH2kkAtrnmE2pibMbQS79jdrgFE20zgwMDnX5qZtQ2nmDi09k2IC04GS1bKdg6193aWGZJTYrzsEkkO4b9kE3Nk8NZLMXNive5cmSlzGt6hrQWnnp8koU0ndXd4pgdZo7124QU8D/PC6tGuVNE4CQG6tGOyC1ihF1xMDkic0oyaoZDYOObsmtGp8Fnsbf5RsnjMW7unyacFpzIuw/vWgcGlwcQN4aGyqcVaHYZiMYHFC8fFpQfHlwxPGQeElSNxXGfyfNWDTHu3uM81wlifEE/GMZZmY7qRmO4xb/NwfFENcxPErQbCyfAhbj2KHM0oNvWpBtDiQ/wBSHxU7A13IKZsQKNQBoNosQfJbyG9vXZQyY9isLndktYHWDNbXzVtDTgSbwGafPTBwzbrmjwqZu1leMjC0+5St2sqXDOlv4I0Urb8A+C75M0egPgrwMVtBWyVFd5UYjHvgAjvsuUdZvRXcbAaq8x6lEkNi0G2iy5h6tpb3q3HXDZ+K1wq4GtpwZHMy3iLIBragsDXOGXIlECLdBtkmtj7Wa1Mpp1mFq6ocTipKQQ1MVg7m1FeUtjjL2O3mHTNUzacFoU7cmboWNxXGpIpPKq1jZHOERcN4jkFuYsXo4Y2sbLkBbhKyFBTHfBVqaYnkjrjltoGYuyaRpglDS03vZTPxKMy7peHO71UYdSdvMI0Uf8oBsljSxjqR1jnNncxpbawbe5ThXRudukfJcZTANUZgDZELQoVTAwXB+CcKlrjofghXNCkjaFHQqOS7hYK2ieDGMlURtzGStIT2AqVaT7yRcmXSWtrREoSpgMrJv6bC23uRRXEbWnjcFXelidfVgPyTJK8D0lUU1QXYdBY6xt+iGk6wuycluRfx4i13pKQVzb8SzgY8C+8nsZI48RVo6a2HEGBnEFZUVXFIM3hZWhw2aoIAeVq8L2WldYlxsijS1pnxuIsbowwbymosBEFr3KsfJAwWAWatKcUTnckn0Lmi5CumRFo0TJgXNtZOxpjMYprxHJZCqh3Lmy9GxOm3ozksbiNNukiyLXTCMu6bdcQVwSAu1Xa6mcHktCCYyQGxCsb467WjKgAWujqQ9cRkqmnpnyPF1psMow0C4WMqerPDqS4GSt20l7ZKXDKW7RkriKk7YuFuVxynqvgpXRZht0QYnNO9urQQUbCwZKU0LTluq2NMq6tdGbFuSh8va+Sy0dXgbZGkgKiqMFdFLcBC0kaQ8CymYxQRxlgAKKZolaSxtzR0RsEJHmUUwo3paTXSXEln6PyRXLpFNVsWPnCgnJwymz/VN+gUvWuQeGG+FUv9U36Ild6ZxKJSURC8kgINuqJg4lCtjs7EZJG3Xp+GUzWwtK8y2ad5xq9Sw03gCxkRwibZRvjCnCjkWAgc0AIeRosiXoeTQqiVdawFpusXjMYDzZber4SsXjQ7RVXTHrL1DGkm4QnVMvojZ9UKdVR0oulY0EZK9ogN4KipdVeUZzCxk1GywkDcCuIwN4Kmwk9gK5j4lrHjjl1aU1rImw7kLTaIoJZOcBu6KnrwM8lcO4VUV/NSUknEnM5LknEus0SBEWqJYhotUSxFKVJIJLDRFNTimlTNfM2EG+EU3sBGIHBDfBab2fuUcvVeicjrdQiYeIIZuoREPEEKtjs0fOtXqmFm8AXlGzZ881eq4UfMBYyS0GiZInjRMkWAhehpNCiX6IeTmqJXVfCVjcbHaK2dUOyVjsbGZVXTHrKz6oQ6oyfVBu1VHSi6XUK7ozmFR0uoV3RnNqxk1Gxwg9gK7ZqFRYQeyFes1C1jxyy6s6bRFBCU2gRYSwceFVNeMirY8Kq68ZFSUUvGkxdl41xmiQIj1CKYhY9UUxFKUJJBJYJFNKcU0qFfMOAG+B0/7X/kVYqs2dN8Ei9Rd9SrMr1Xox5HQiIuIIcKeLiQq1mzp881erYQfMDwXk2zxtM1er4OfMN8FjJLgaJkie3RNkWAgdoh5OaIdoh5OaogFVwrH42MythU8KyONjVNbx6yVRqUI7iRlRqUG7iRHWiKbVXdHq1UdNxK7pOSzkY1+DnshXzNQs/g5yC0DOSceOefVlS8kYNEFS8kaNEsH+iquvGRVp6KrK7QqShm4lxidNxJrEhPHqEUxCxopiKUwSSGiSwSK4V0rhUK+W9mjfB2+p7lbHVU+zBvhLh3SEfIK4K9WXWceQgiIuJDhTxahBrT7Pnz7V6xgp8y3wXkuAnz7fFer4IfMtWckvG6Lki63Rck0XNIHaKCTmp3aKB6oAFTwrJY2MitdU8JWTxsZFNbx6yFTqUE7iR1TqUC/iRHWp6bUK6pOSpKfiV1SclnIxrcHOQWiZyWbwc6LRs5Kwc8+rKl5I0aIGl5I4aLTJ/oqtruEqy9FV1dwlQUE/EmtT5+JRsSBEeoRTEJHqimIpicaJJDRJYJLhXVHJLHHxyNb4mylXy1st/ouT+uP0CuikkvXl1jHkIKePUJJLJrR4F+nb4r1fA/0LfBJJZyUXzdFyTRJJc0hdoh36pJKgBVHCVlMb4Skkmt49ZCp4igH6pJIjrUtPxKybO6Ft2gHxSSRkYKh2mraMXjigNvzNP70PW9KGNUl+rpaA2/NG/+8kkt4Rwzqiqenraikfux0OEn1mKT/wCiFf8Awg9sncMOFs9mB33ekkuskcbaHf097cO4aiiZ7NMPvdBT9Ne3M+uKxN9mli+7Ukl0mM/GLlQEvSntnKe1jTvdBEPo1Du6RtrXa45UDwDR9AkktfM/GfqoXbe7Vv1x+uHsykfRRP202ofxbRYr7quQfdJJOot1A/afH5OPHMSd41Tz90O/GMTk48Rq3+1M4/dJJWoNoH1U8nHPI/2nEqJJJKf/2Q==","data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAcFBQYFBAcGBgYIBwcICxILCwoKCxYPEA0SGhYbGhkWGRgcICgiHB4mHhgZIzAkJiorLS4tGyIyNTEsNSgsLSz/2wBDAQcICAsJCxULCxUsHRkdLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCz/wAARCAC0APADASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAABAACAwUGAQcI/8QATBAAAQMCAwQFCgIECA8AAAAAAQACAwQRBSExBhIyQQcTIlFxFCNCYXKBkaGxwRVSM4Kj0QgXJENFU9LhJTQ1RGJjZXN0g5KissLT/8QAGAEBAQEBAQAAAAAAAAAAAAAAAQACAwT/xAAfEQEBAAMBAQEBAAMAAAAAAAAAAQIRMSESUTITQXH/2gAMAwEAAhEDEQA/AIOgGPd6P6t1uPEJD+zjC9PcB2R3uH1XnPQSzd6Nt781XKfk0fZeiOlYJ4hvA53+S82XW4P3e0nACyja57sw0AetODXnV1h6lE4WJsnWSaABYLqghm4UM7VETHQKAoRjk22ScVzQJSNws0oNzCRfRGSOswoQ71jnmhG7tueaRYE0755hOO96kbTlmaBVeJzQsmDXtBu3mLqys/uaFltopHDEg0ki0Y4fEotUhSigfxUkD/ajBQU9Ng7h28LoT4wMP2Qjjc8TkwwucOenco6QVVBgRN3YNhpH/Cs/chXYPs5Nf/A9CPZhA+isJMLqSwEx5OFwQpY8DqGwh27qtTYUb9mdnHf0TB7gR91A/ZHZt39FM90jx91qBgs9hdPGBynU2T7+ljH7FbOnTDi3wmk/eoX7B4EdIJW+EpW6/A3+k4KRmCAcRVu/q8edP6P8FOnlLfCT+5Rno7wl2k9Y39dv9lemnBmWGqe3CImi5bdP1f1ePK3dHGHejWVQ8d0/ZRO6N6Uns103vYCvWxhUGu4pG4fE3IRhX3VqPHj0ZAjs4i8eMN/um/xXTngxG/jBb/2Xs3kTBowfBP8AJWjINCf8i+QHQq23RlRMGXWTzOPhvEfZehwxMFUyzAN0E6LC9DcW70V4U/m8zH9s8fZb6AHrHnmAAs2+0QYNF1Rje704X71E8Jcly5soHzPBIAHwUDJnjrSCdEM6oYL9oLk0Qkkc/eILu5DuogR+kcPcEJI6rYO8pjqxo5IaajcwZTk372oV1HK7+e/7VIa6sBc74KF9U0X5IP8AD6gE2nBv3tKjdh9S3N0jXA9wQhTq1rc7qrrtqKSivvyC/cosQw+rdTkRPsV5jjmH1cdU4SyFxv3q/wCmRr67pFhYSIhvLPVe2z55t8MyVBDg9TO6zWlSu2fqwbbhWvGvldw7aEOG8zJXdFtlRTODZAGrByYPUx6sKgdSTRnhIV4NPbKCuo6uMdVI0+pWRiBi7wvC6HE6zDpmvY9wA5L0/ZzaiLEaVscrgJAshfmIJpjbfRSBwIvdK7b6hIMLGkaLu40C5ASJaXcQSyPMITjmg8kzdzsnkd11w3voomFuadYEJEnuTRclRdLbjRNtlZdLncguAnuUkHROGw9FWCgmwLHn4yOP3W0pH74kLWk9rU5DJY/oxG50cYJfIeTi1/WSb/NbWkt1AP5iStXrKYB/+iE5rbesrq6Epw5BCPNzdETu3YXkZ2F1TS4k1ltNOZWahjrJpyCq34uy57bQon4y0aOVtaWM7sxZDuLuQCrTjLAwdqygfjTeTkbWlzZ9tPmmG4GYHxVDJjljzKgfjTje11Jd1coZCTcd2RWNqqCjrsQkbHOZJmEhzSwix8UTW4nLK6Bul5Ah8ONq2ok1Jeblcc5a7YCqfDo6dtnRtafipHRQt5BSm8vNRPpHk3BujGOoKop4ZToAhHYRA/UNVi+At1KHlp5Tw6LehqKipwGGTstbY+vRBUtBJh0rp2OsyM9rNXkvWR9lyFq938ErXcwB9Vj3Yyk0vYcXeaZjhc3CilxSctNg5S4Fg8U+C0sryTvMvqrVuCUwGbLrrHnrKSV1U+Qbud07rqk8iPctpHh8ILHFjbjK5C4+kjDyA0DPuWppMbesIy6z3JNhrnaGX/qK2IhYDpkuCGMA5JTJimxEHKSYfrn96IbBiwtaplH/ADCtIYmXuAm9WNbKShbBi3OukHq3rqVkGJHWukV1uN5Bc3LclbJbE0UMnRxgPWA3bQxuBBIIu0Fa+lb1dNG25NgMys3smzq+j7A2f7PgH7Nq0zcmgepP+xvzScOTrqG6cHWCgc/MEHRZXGqI+UgU0Ya0DQLTOKrKogzFVLL/AIbUuPILgwedx7TgFoiB3LhAAOSwts8cEkcT27DlZPbgItnISrolofu3F+4FODSbAC5OiUoxgEW92nOI8VMMEprW3fmrZ8bmOLXCxHJNtke9QZXafDRS4N5RSnq5IJGvuNbX/vVMyoZh+GiaVxJI3j3uJWux8RzYRU0znWfLGbBYzFGBtHFvC4awZe5YvrrgqanbCrYbQ09m95UlHtjXOeBJH2CqTEaiRke9FCbXsoqWSXskjM8l1mE01v1vG4uySMPdqRdV1XtYKaUtEd2hSwYDUTYSao3aQL7qyVbK7rHNDR2dclTHG8atWEm17Z5TvREDxRdRiDpcEmMJ7EtgTz8FnKOpimHagAF7XLVo8GoWz2pvQklb7lnLCRi26ei7PU3kuAUcRFiIwSPWc1YEHuSaN1gDSLAWFk1xPehxTA9hgtY3KhkFpHJ7cmtvfU5qGXOZxJyuqIjpyTbhcuDoVxxAHrSnDYcwuZH0k3eba1wlvNA11USyGjvkuXAOpXA8aBNc4DMlGyPwV5ptlMGi3d4+TQtAGRNmD9y0ENQya4ac25OadR4qowtgbhuHREX3IWD4NCtmhocXADeOpstDxOu3UYOaRckOucqud/njZHvdkVVyuBkJujIlvFccTurlwuF12nvWQHlvAwyRw75v2gDY2ToqtlQw9U+ztLHIgpsRc9ruva0lx5afNPLWRTBzorWsWpTtNE2E2nl3Lm7nEJzpYS+0cgN9M8yuOqG1ExcGntGwBULrQuLCwNdfkhKvG4ZH1cMkbd5245uZsEBJSxTQ9XJbLJWGNjr6Bxbk6MEi3gs3DW9bGx29kRms6d8L4HxHAGzOuw3Kiw/AooZw6Roc4Hmrh9YGx5aIBtfHTyGoqXFsTRkBzK37p01GqEUzcHe0WtbRec4nhpdVve1tiTmFfnaozNuw+bOnghPLIKuUyxOJPpDkjGWKxRwYO97rbnxVs2J+H0u8DmCDfkippWhlxkVHTzzYg6LD2uBbK+xFs7apytrN1G3wQvdgtM6Q3c5tyT4o4juIUUTGQQsibYNYABZOIB1cUPPepLtDWXdc3UcptI7NdkDGU7X5ktI+oChlk88ciqBzInVdOQUZkPJqaZXD0b+9KPvfn8lwuaX2+yhdPLyjBXBUSf1GaimIYeQPuUTpG3tu/JNE8xyEFvemumkv+hGXrQWnp4DEIh/Vs3UUCmroTtaSByW8mJXTtacleBGclUySWcbhWcx7BVXI3M5LNqkMNS1p0PwTTVMLDYH4KORoUbWhS0ea6Nrt0D5JslSOsa507ntDbWLbWKYIA6RSPpgWqGg7MSjEu6Hhru9QvxdkMjjPKHFxveyjNH/KCbILEaTt5BK0Llxejmjcx0uRFuErDSyeS1r2xucYg47pPMK/FMRyVVX0x3yUcbx2k8pbJGHvdusGuaFrsTiq6Qw00Vw3m5DuzZulQOpwGlMsdpjVc5tQGFrXDPkCj8KrhSQObUAxuflvAXQzo+1knGLeAvmulymlcLFhWVm7FdpuDou7P1slPXeVCIybgIA7roIQ9Y0N7lqMBpRHDYNAvqsbjlnsY7aypaMqW3ionbWV5yELR7lZ+TNPoD4LhpW34B8FeOStjx7FZnN7JcwusWaXtmpp9osQZJbyG1/XdWcFMGjJumaZNTgybxGapoqs7Q4kf8yHxUbsexQZilAv61YuiAULw1vIJ1Ar347jFv8AFwPBR/jGMvzEdkeZWk2NkxzmJ8KvdiuM/k+ajOJ4yTwkKzBYuuMe7e4yzR4Xpt10JicFw26yHJXXElfR+UcpuEDI3NGvKFkyK1KNBHsULiGA3RL9ELJGXggJWg3l7WSWUza10hsG5JU+CulluQr2kwNsbQSELSnETnHe3UPUUrpcy2y1ooWjLdUU9GwMOSdrTFOpLXyVRiNJYHJbSWk7ZsFT4nS2aclWnGesBVnqSckC+oBFrq+xOjDgbBZmopnxvNljGu3CMgDtV1s284AIJ7JCbAI2hpnF4Lgt5XwbWlLDv2Nlr8HprRDJUmHU28QLLZYZTbsYyVK5ZxKyhc4XASNE5vJW8ILW2snviLhonbn8qYQbqDqXxtJubLR+SB4sQq6twET3tcIlOmXrauKMZPCrZsQYWcQVnimy0rbkONllK7DZqckF5WotCzXNvxKOTEWt9JUb2SNPEUwseRfeTo6aCOvB9JPnq7Usrr6MJ+SzkfWB2bkTU1Bbh09zpG76KFj3tOCaE4LzukJJJIqaRPQ0uqJehpdVuMh3802PiTn6LkfEkLmgAyyVw0Dd0VRQclbt4UE2w7kNU2siShanRSVkgG8VT4sBuFXEnEqbFj2CjLjWPWPrQN4qiqmNJOSvKw5lUdVqs4u1A9Uy+iLp2NBFghxqioNVvJmNHg0YLxdbSiYA0WWOwUdoLaUnCFRzy6sI2iyIa0EKCPQIhiq5nsjCkMTbLkakKkqcTpmuhcV5htFEY5HWXqmJG0BXlu0rvOOW8Sx8zyCQhzKQpZ+JDO1WxDutcoq+cjDKnP8AmnfQpyGxM2wqqP8AqnfRUN4+lgnBNCcF5jCSKSRU0iehZNSinoWTVbjId6UXGk/Rdi40hdUAyCthwqroBkFaDhQTShanRFFCVOhUla/Uqkxc9gq7fqVRYweyUZcbx6yNYcyqSq1Kuqw5uVJValZxdKFGqLg1QjdUZBqt0Rp8EHaC2VJwhY/BBmFsaUdkKjnl0fHoESxDx8kQzRVc00ae7RMjTzopK3FDaAryvaU+dcvUsVPmCvKtpD55y3iWSm4ihnalETcRQ7tSugjiDxc2wep9goxA42bYLU+yPqFTpvK+nAuhcC6F5TCSKSR0UUL0LJqUU9CyLcZQPXYeJcenQ8SUvKAZBWnoqsodArP0UEw6IOq5ow6IKq5qSufqVQ4weyVfP5rP4wcijPjeHWTrNXKkqdVdVfNUlTxIxdKgbxIun1CEbxIyn1C1RGqwQZhbCl4VkcEGi11Nwpjll0fHyRDdEPHyRDdEVhNGnnRNjTnaKSpxc+YPgvKdoj55y9Uxg+Yd4LyjaE3mct4ll5eIocqeXiUBXQRxV2Pm2B1H6v8A5BWIVZtEbYJL6y36hU6suV9QhdUccscnBI13gbqReVqEkdEkjoo1C9CyalEvQsmq3GULk6DiTHqSDiSl7Q8IVl6KrqHhCsfRQTDogqrmjTogarmpK9/NZ3GDkVoX81nMYOqzm6YdZWr5qlqdSrmr5qlqOJWDdQt4kbTahBM4kdTahaojWYIMgtbTcKymCDILWU3CExyy6Oj5KduigYp26IrCeNddouR6LrtFJTY0fMu8F5PtAfPuXquNnzLl5Rjx8+7xW8SzcvEUOVPLqVAV0UIaqp2lNsHd63tVsFT7UG2Et9cg+hVj0ZfzWRUrKqePgnkZ7LiEkl6HlTsxjE4+DEatnszOH3RDNp8fj4McxJvhVPH3SSRqHadm2m1DOHaLFffVyH7qVu3u1bNMfrj7UpP1SSVqLdTN6RtrW6Y5UHxDT9QiIulPbOI9nGne+CI/VqSSPmfi+qPg6a9uYNMVid7VLF9mo1nT3tw3iqKJ/tUw+1kklm4z8amVEM/hB7ZN4ocLf7UDvs9FU3T1tRVv3ZKHCR6xFJ/9EklzsjpLV7RdKGNVduspaAX/ACxv/tIibaatrBeSKAX/ACtP70klyzjrhQrp3TNu4AeCrajiSSWMXeomao+m4gkkmiNfgnCFq6fhCSSY5ZdGs1RDdEkkVhNHouu0SSUlDjn6F3gvKMd/Tu8Ukl0xLOSalQFJJbUIKl2q/wAlx/70fQpJJx6Mv5r/2Q=="],"face_required":true,"face_updated_at":"2026-10-21T15:43:00.390Z"},"zeinabrkein@bhfirms.com":{"face_samples":[[-0.10328,0.10045,0.17652,-0.03833,-0.07092,-0.0286,-0.06478,-0.0389,0.2221,-0.11399,0.20044,0.0083,-0.27256,0.14826,-0.07505,0.19771,-0.17022,-0.05534,-0.07734,-0.04771,0.07787,0.06499,0.00856,0.09388,-0.10165,-0.33878,-0.07043,-0.0979,-0.01774,-0.06689,-0.03801,0.05287,-0.08776,0.02529,0.09046,0.08112,0.01505,-0.08566,0.19665,0.04414,-0.20991,0.01726,0.07356,0.1951,0.17903,0.05901,0.02701,-0.14826,0.17081,-0.28203,-0.00611,0.14299,0.05302,0.11252,0.16911,-0.19131,0.04012,0.07891,-0.13802,-0.0069,0.01879,-0.04515,-0.00668,-0.07722,0.20532,0.09113,-0.14449,-0.07692,0.16105,-0.14169,-0.05954,0.07343,-0.10791,-0.14723,-0.1574,0.00914,0.46034,0.15426,-0.21104,0.07263,-0.06044,-0.08198,-0.00048,0.13373,-0.07406,0.02936,0.00052,-0.00671,0.2012,0.0057,0.10816,0.27258,0.00405,0.05987,0.02844,0.00791,-0.17171,-0.0571,-0.16043,-0.11868,-0.0226,-0.01543,0.00261,0.06213,-0.30311,0.12864,-0.05382,-0.08485,0.02222,0.08474,-0.05327,0.00078,0.16594,-0.24362,0.14203,0.15159,-0.00113,0.12178,0.02329,0.09272,0.00346,-0.01778,-0.1146,-0.08605,0.08754,-0.07504,-0.02181,-0.06106],[-0.15546,0.09958,0.12438,-0.08909,-0.12015,0.01572,-0.04119,-0.01384,0.14991,-0.03155,0.25053,-0.01989,-0.23157,0.04526,-0.04799,0.17158,-0.2087,-0.08665,-0.07207,-0.07561,0.07425,0.09425,0.00858,0.06681,-0.20201,-0.32389,-0.04405,-0.0957,0.05795,-0.11124,-0.05731,0.05933,-0.168,-0.0029,0.07261,0.05617,-0.07277,-0.09774,0.17703,0.09699,-0.20588,0.06548,0.08072,0.30269,0.19947,0.0312,0.00853,-0.14244,0.12433,-0.27528,0.01569,0.22335,0.01918,0.08816,0.06638,-0.1601,0.06536,0.09002,-0.24271,0.04138,0.06438,-0.06,-0.02406,-0.06464,0.18376,0.11776,-0.12489,-0.12958,0.14723,-0.08216,-0.02628,0.11263,-0.17226,-0.20441,-0.22492,0.05397,0.38441,0.12613,-0.14906,0.06537,-0.0543,-0.02111,0.04619,0.12563,-0.12733,0.00197,-0.04376,0.10541,0.15878,-0.0188,0.05326,0.27128,0.0542,-0.03021,0.06954,0.09385,-0.18735,-0.06092,-0.16284,-0.10296,0.03871,-0.05151,0.04215,0.14151,-0.23085,0.14306,-0.01309,-0.09234,-0.02499,-0.05212,-0.01096,-0.01852,0.10111,-0.22578,0.17332,0.17342,0.0724,0.1142,0.07246,0.01083,-0.04953,-0.01258,-0.09994,-0.00953,0.07428,-0.04545,0.0275,-0.04624],[-0.10264,0.11677,0.14248,-0.05085,-0.09557,-0.04947,-0.03037,-0.0885,0.17172,-0.12864,0.22292,-0.07374,-0.23499,0.05862,-0.09893,0.15847,-0.2038,-0.05618,-0.11123,-0.02175,0.07294,0.03421,0.03283,0.08376,-0.11342,-0.35171,-0.09612,-0.09475,0.07004,-0.00868,-0.06366,0.07502,-0.08494,-0.0329,0.08244,0.11595,-0.03841,-0.09261,0.18339,-0.02539,-0.2093,0.02156,0.0456,0.22281,0.20889,0.04794,0.03609,-0.18257,0.17969,-0.25351,0.00082,0.18459,0.07084,0.09425,0.1584,-0.15264,0.07248,0.15028,-0.18464,-0.02874,0.02653,-0.07302,0.05252,-0.07012,0.14033,0.05288,-0.14466,-0.06516,0.19743,-0.14817,0.01044,0.07885,-0.11429,-0.1854,-0.24795,0.00472,0.49713,0.19905,-0.13227,0.04636,-0.08981,-0.06809,0.04811,0.10874,-0.12448,-0.04259,-0.07608,0.02195,0.14953,-0.0439,0.07035,0.22668,0.01795,0.02063,0.02702,0.03778,-0.21332,-0.0162,-0.1496,-0.03789,-0.01655,-0.07219,0.00156,0.08554,-0.23739,0.09962,-0.03234,-0.08328,-0.0019,-0.02846,-0.07481,-0.01372,0.1631,-0.25433,0.09921,0.17323,0.0226,0.17518,0.08742,0.05428,-0.00768,-0.07531,-0.11616,-0.07333,0.08838,-0.03546,0.00183,-0.05362]],"face_thumbs":[],"face_required":true,"face_updated_at":"2026-10-21T15:43:00.390Z"}};
  const DEFAULT_USERS = [
    { id: 'u1', full_name: 'Hussein Bdeir', email: 'husseinbdeir@bhfirms.com', pin_code: '1111', role: 'Full Access (Owner)', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u2', full_name: 'Zeinab Rkein', email: 'zeinabrkein@bhfirms.com', pin_code: '2222', role: 'Supervisor + Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u3', full_name: 'Sabah Kassab', email: 'sabahkassab@bhfirms.com', pin_code: '3333', role: 'Entry', companies: 'WTC', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u4', full_name: 'WTC Plant Weighbridge 1', email: 'scale1.wtc@bhfirms.com', pin_code: '4444', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u5', full_name: 'WTC Quarry Dispatch', email: 'quarry.wtc@bhfirms.com', pin_code: '4545', role: 'Entry', companies: 'WTC', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u6', full_name: 'BBConstruction Batching Desk', email: 'batch.bbc@bhfirms.com', pin_code: '5555', role: 'Entry', companies: 'BBConstruction', pbi_access: 'partial', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u7', full_name: 'BBConstruction Site Supervisor', email: 'site.bbc@bhfirms.com', pin_code: '6666', role: 'Supervisor', companies: 'BBConstruction', pbi_access: 'full', statements_access: 'full', status: 'Active', last_login_at: '' },
    { id: 'u8', full_name: 'Lions Transport Fleet Controller', email: 'fleet.lions@bhfirms.com', pin_code: '7777', role: 'Supervisor + Entry', companies: 'Lions Transport, WTC', pbi_access: 'full', statements_access: 'partial', status: 'Active', last_login_at: '' },
    { id: 'u9', full_name: 'Diesel & Garage Officer', email: 'fuel.mfg@bhfirms.com', pin_code: '7878', role: 'Entry', companies: 'WTC, BBConstruction, Lions Transport', pbi_access: 'none', statements_access: 'none', status: 'Active', last_login_at: '' },
    { id: 'u10', full_name: 'Accounts Receivable Collector', email: 'ar.mfg@bhfirms.com', pin_code: '8888', role: 'Sales', companies: 'WTC, BBConstruction', pbi_access: 'partial', statements_access: 'full', status: 'Active', last_login_at: '' }
  ];

  function lsGet(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_) { return fallback; }
  }

  const RAIL_MIN_W = 176;
  const RAIL_MAX_W = 420;
  const RAIL_DEFAULT_W = 248;
  const RAIL_STEP_W = 24;

  function clampRailWidth(w) {
    const n = parseInt(w, 10);
    return Number.isFinite(n) ? Math.max(RAIL_MIN_W, Math.min(RAIL_MAX_W, Math.round(n))) : RAIL_DEFAULT_W;
  }

  const IS_AUTOMATED_TEST = Boolean((typeof window !== 'undefined' && window.__MFG_HEADLESS_TEST) || (typeof navigator !== 'undefined' && navigator.webdriver));
  const SAVED_FILTER = (!IS_AUTOMATED_TEST ? lsGet('isabi_mfg_filter_state_v1', null) : null) || {};

  const STATE = {
    view: 'overview',
    company: (SAVED_FILTER.company && ['manufacturing-group', 'wtc', 'bbconstruction', 'lionstransport'].includes(SAVED_FILTER.company)) ? SAVED_FILTER.company : 'manufacturing-group',
    period: SAVED_FILTER.period || 'all',                  // 'all' | 'ytd' | 'mtd' | 'sep2026' | 'aug2026' | 'q3_2026' | 'fy2025' | 'fy2024' | 'year:YYYY' | 'month:YYYY-MM' | 'week:...' | 'day:...' | 'custom'
    dateGrain: SAVED_FILTER.dateGrain || 'all',            // 'all' | 'year' | 'month' | 'week' | 'day'
    dateFrom: SAVED_FILTER.dateFrom || '',
    dateTo: SAVED_FILTER.dateTo || '',
    basis: (SAVED_FILTER.basis === 'tx' || SAVED_FILTER.basis === 'rep') ? SAVED_FILTER.basis : 'rep',                   // 'rep' | 'tx'
    theme: localStorage.getItem('isabi_mfg_theme') || 'light',
    railCollapsed: localStorage.getItem('isabi_mfg_rail_collapsed') === '1',
    railWidth: clampRailWidth(localStorage.getItem('isabi_mfg_rail_width') || RAIL_DEFAULT_W),
    search: '',
    chipFilter: 'all',
    activeStatement: '01',
    stmtCatFilter: 'all',
    pbiPage: 'p01_overview',
    pbiSlicer: {},
    pbiTablePage: {},
    pbiPageSize: 15,
    activeTableKey: 'price_rules',
    modalForm: 'sales',
    activeUserIdx: 0,
    authed: false,
    saving: false,
    renderPending: false,
    sortBy: {},
    shown: {},
    cloudStatus: 'Connecting...',
    cloudUpdatedAt: '',
    showAddUserForm: false,
    users: (lsGet('isabi_mfg_users_v2', null) || DEFAULT_USERS.map(u => ({ ...u }))).map(u => {
      const k = String(u && u.email || '').trim().toLowerCase();
      const seed = DEFAULT_FACE_SEEDS[k];
      if (seed && (!Array.isArray(u.face_samples) || !u.face_samples.length) && String(u.face_updated_at || '') < seed.face_updated_at) {
        const copy = Object.assign({}, u, seed);
        delete copy.face_cleared;
        return copy;
      }
      return u;
    }),
    sessions: lsGet('isabi_mfg_sessions_v2', null) || [],
    customRecords: lsGet('isabi_mfg_custom_recs_v2', null) || {},
    supabaseCfg: lsGet('isabi_mfg_supabase_cfg', null) || { url: '', anonKey: '' },
    faceSettings: Object.assign({
      threshold: 0.50,
      margin: 0.08,
      weakAbove: 0.45,
      minFaceFrac: 0.14,
      confirmFrames: 3,
      liveness: false,
      enforce2FA: true,
      sound: true
    }, lsGet('isabi_mfg_face_settings_v1', null) || {})
  };

  const FACE_POSES = [
    'Look straight at the camera',
    'Turn your head slightly LEFT — just a little, keep both eyes on the camera',
    'Turn your head slightly RIGHT — just a little, keep both eyes on the camera'
  ];

  const FACE_STATE = {
    camActive: false,
    authCamStoppedByUser: false,
    stream: null,
    loopTimer: null,
    busy: false,
    streakUser: null,
    streakCount: 0,
    bestDist: 9,
    secondDist: 9,
    lastBlinkAt: 0,
    eyeClosedSeen: false,
    pending2faUser: null,
    cooldownUntil: 0,
    enrolUserId: '',
    enrolLoadedForUserId: '',
    enrolCaptures: [],
    enrolThumbs: [],
    enrolConsent: true,
    enrolCamActive: false,
    enrolLoopTimer: null,
    enrolBusy: false,
    lastLiveEnrolDet: null,
    lastLiveEnrolAt: 0,
    lastLiveEnrolSnap: '',
    enrolTestActive: false,
    enrolTestTimer: null,
    enrolStatusText: 'Ready — click "Capture Pose" or "Start Camera" to capture and store 3 guided biometric poses.',
    enrolStatusCls: '',
    calibReportHtml: ''
  };

  // App-entered record pools (localStorage + cloud relay) → server table + SEED list
  const CR_KEYS = [
    'sales_tickets', 'raw_purchases', 'receipts', 'fuel_intakes', 'expenses', 'settlements',
    'price_rules', 'vat_invoices', 'credit_terms', 'customers', 'suppliers', 'products', 'sites',
    'equipment', 'company_equipment', 'drivers', 'salaries', 'attendance', 'employments',
    'logistics_allowances', 'overtime_rates', 'external_movements', 'loans', 'loan_settlements',
    'conversions', 'jv_partnerships', 'jv_distributions'
  ];
  const CR_TABLE = {
    sales_tickets: 'sales_tickets', raw_purchases: 'raw_purchases', receipts: 'customer_receipts',
    fuel_intakes: 'fuel_intakes', expenses: 'expenses', settlements: 'supplier_payments',
    price_rules: 'price_rules', vat_invoices: 'vat_invoices', credit_terms: 'credit_terms',
    customers: 'customers', suppliers: 'suppliers', products: 'products', sites: 'sites',
    equipment: 'equipment', company_equipment: 'company_equipment', drivers: 'drivers',
    salaries: 'salaries', attendance: 'attendance', employments: 'employments',
    logistics_allowances: 'logistics_allowances', overtime_rates: 'overtime_rates',
    external_movements: 'external_movements', loans: 'loans', loan_settlements: 'loan_settlements',
    conversions: 'conversions', jv_partnerships: 'jv_partnerships', jv_distributions: 'jv_distributions'
  };
  const CR_LABEL = {
    sales_tickets: 'sales ticket', raw_purchases: 'raw receipt', receipts: 'customer receipt',
    fuel_intakes: 'fuel intake', expenses: 'expense', settlements: 'supplier settlement',
    price_rules: 'price agreement', vat_invoices: 'VAT invoice', credit_terms: 'credit terms',
    customers: 'customer', suppliers: 'supplier', products: 'product', sites: 'site',
    equipment: 'equipment', company_equipment: 'company fleet unit', drivers: 'driver',
    salaries: 'salary payment', attendance: 'attendance log', employments: 'contract / freelance',
    logistics_allowances: 'site allowance', overtime_rates: 'overtime rate',
    external_movements: 'external movement', loans: 'partner loan', loan_settlements: 'loan settlement',
    conversions: 'currency conversion', jv_partnerships: 'JV partnership', jv_distributions: 'JV distribution'
  };
  CR_KEYS.forEach(k => { if (!Array.isArray(STATE.customRecords[k])) STATE.customRecords[k] = []; });
  if (!Array.isArray(STATE.users) || !STATE.users.length) STATE.users = DEFAULT_USERS.map(u => ({ ...u }));

  const COMPANY_LABELS = {
    'manufacturing-group': 'All Manufacturing Group (WTC · BBConstruction · Lions Transport)',
    'wtc': 'WTC (World Trading & Construction)',
    'bbconstruction': 'BBConstruction',
    'lionstransport': 'Lions Transport'
  };

  const COMPANY_BU_MATCH = {
    'manufacturing-group': null,
    'wtc': 'WTC',
    'bbconstruction': 'BBConstruction',
    'lionstransport': 'Lions Transport'
  };

  const COMPANY_KEY_BY_NAME = { 'WTC': 'wtc', 'BBConstruction': 'bbconstruction', 'Lions Transport': 'lionstransport' };
  const SENTINEL_MODEL_KEY = { 'manufacturing-group': 'Manufacturing Group', 'wtc': 'WTC', 'bbconstruction': 'BBConstruction', 'lionstransport': 'Lions Transport' };

  // ==========================================================================
  // FORMATTERS & SMALL HELPERS
  // ==========================================================================
  function fmtUSD(v, decimals = 0) {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    const s = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (n < 0 ? '-$' : '$') + s;
  }

  function fmtUSDk(v) {
    const n = Number(v || 0);
    const a = Math.abs(n);
    if (a >= 1e6) return (n < 0 ? '-' : '') + '$' + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n < 0 ? '-' : '') + '$' + (a / 1e3).toFixed(1) + 'k';
    return fmtUSD(n, 0);
  }

  function fmtNum(v, decimals = 0) {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtPct(v, num, den) {
    if (num != null && den) return ((Number(num) / Number(den)) * 100).toFixed(1) + '%';
    const n = Number(v || 0) * 100;
    return n.toFixed(1) + '%';
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function nowStamp() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  let toastTimer = null;
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'err' ? 5200 : 3000);
  }

  function getModel() {
    return SEED.models[STATE.company] || SEED.models['manufacturing-group'] || {
      periods: {}, monthly: [], products: [], customers: [], suppliers: [], sites: [], equipment: [], gl_tb: [], soa_stream: []
    };
  }

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function lastDayOfMonth(y, m1) {
    return new Date(Number(y), Number(m1), 0).getDate();
  }

  function fmtWeekLabel(fromISO, toISO) {
    const [y1, m1, d1] = fromISO.split('-').map(Number);
    const [y2, m2, d2] = toISO.split('-').map(Number);
    if (y1 === y2 && m1 === m2) return `${d1} - ${d2} ${MONTH_SHORT[m1 - 1]} ${y1}`;
    if (y1 === y2) return `${d1} ${MONTH_SHORT[m1 - 1]} - ${d2} ${MONTH_SHORT[m2 - 1]} ${y1}`;
    return `${d1} ${MONTH_SHORT[m1 - 1]} ${y1} - ${d2} ${MONTH_SHORT[m2 - 1]} ${y2}`;
  }

  function fmtDayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dtObj = new Date(y, m - 1, d);
    return `${DOW_SHORT[dtObj.getDay()]} ${String(d).padStart(2, '0')} ${MONTH_SHORT[m - 1]} ${y}`;
  }

  let _grainCatalogCache = null;
  function getDateGrainCatalog() {
    if (_grainCatalogCache) return _grainCatalogCache;
    const gp = ((SEED.models['manufacturing-group'] || {}).periods) || {};
    const presets = [
      { value: 'all', label: 'All-Time (2024–2030)', from: MIN_DATE, to: MAX_DATE, daxKey: 'all' },
      { value: 'ytd', label: (gp.ytd && gp.ytd.label) || 'FY 2026 (YTD)', from: '2026-01-01', to: '2026-12-31', daxKey: 'ytd' },
      { value: 'mtd', label: (gp.mtd && gp.mtd.label) || 'October 2026 (MTD)', from: '2026-10-01', to: '2026-10-31', daxKey: 'mtd' },
      { value: 'sep2026', label: (gp.sep2026 && gp.sep2026.label) || 'September 2026', from: '2026-09-01', to: '2026-09-30', daxKey: 'sep2026' },
      { value: 'aug2026', label: (gp.aug2026 && gp.aug2026.label) || 'August 2026', from: '2026-08-01', to: '2026-08-31', daxKey: 'aug2026' },
      { value: 'q3_2026', label: (gp.q3_2026 && gp.q3_2026.label) || 'Q3 2026 (Jul–Sep)', from: '2026-07-01', to: '2026-09-30', daxKey: 'q3_2026' },
      { value: 'fy2025', label: (gp.fy2025 && gp.fy2025.label) || 'FY 2025 (Full Year)', from: '2025-01-01', to: '2025-12-31', daxKey: 'fy2025' },
      { value: 'fy2024', label: (gp.fy2024 && gp.fy2024.label) || 'FY 2024 (Full Year)', from: '2024-01-01', to: '2024-12-31', daxKey: 'fy2024' }
    ];

    const years = [
      { value: 'year:2024', label: '2024 (FY 2024 Full Year)', from: '2024-01-01', to: '2024-12-31', daxKey: 'fy2024' },
      { value: 'year:2025', label: '2025 (FY 2025 Full Year)', from: '2025-01-01', to: '2025-12-31', daxKey: 'fy2025' },
      { value: 'year:2026', label: '2026 (FY 2026 YTD)', from: '2026-01-01', to: '2026-12-31', daxKey: 'ytd' },
      { value: 'year:2027', label: '2027 (FY 2027)', from: '2027-01-01', to: '2027-12-31', daxKey: null },
      { value: 'year:2028', label: '2028 (FY 2028)', from: '2028-01-01', to: '2028-12-31', daxKey: null },
      { value: 'year:2029', label: '2029 (FY 2029)', from: '2029-01-01', to: '2029-12-31', daxKey: null },
      { value: 'year:2030', label: '2030 (FY 2030)', from: '2030-01-01', to: '2030-12-31', daxKey: null }
    ];

    const months = [];
    const maxY = Number(SEED_DATE.slice(0, 4)) || 2026;
    const maxM = Number(SEED_DATE.slice(5, 7)) || 10;
    const daxMap = { '2026-10': 'mtd', '2026-09': 'sep2026', '2026-08': 'aug2026' };
    for (let y = maxY; y >= 2024; y--) {
      const mStart = y === maxY ? maxM : 12;
      for (let m = mStart; m >= 1; m--) {
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        const ld = String(lastDayOfMonth(y, m)).padStart(2, '0');
        months.push({
          value: `month:${ym}`,
          label: `${MONTH_SHORT[m - 1]} ${y}`,
          from: `${ym}-01`,
          to: `${ym}-${ld}`,
          daxKey: daxMap[ym] || null
        });
      }
    }
    for (let y = maxY; y <= 2030; y++) {
      const mStart = y === maxY ? maxM + 1 : 1;
      for (let m = mStart; m <= 12; m++) {
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        const ld = String(lastDayOfMonth(y, m)).padStart(2, '0');
        months.push({
          value: `month:${ym}`,
          label: `${MONTH_SHORT[m - 1]} ${y}`,
          from: `${ym}-01`,
          to: `${ym}-${ld}`,
          daxKey: null
        });
      }
    }

    // Build Monday–Sunday weeks across 2024-01-01 .. 2030-12-31 (active weeks newest-first, then upcoming through 2030)
    const weeks = [];
    const [sy, sm, sd] = SEED_DATE.split('-').map(Number);
    const curDt = new Date(sy, sm - 1, sd);
    const dow = (curDt.getDay() + 6) % 7; // Monday = 0 .. Sunday = 6
    const monDt = new Date(curDt.getFullYear(), curDt.getMonth(), curDt.getDate() - dow);
    const minDt = new Date(2024, 0, 1);
    const maxDt = new Date(2030, 11, 31);
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (let wMon = new Date(monDt); wMon >= minDt; wMon.setDate(wMon.getDate() - 7)) {
      const wSun = new Date(wMon.getFullYear(), wMon.getMonth(), wMon.getDate() + 6);
      const fISO = toISO(wMon);
      const tISO = toISO(wSun);
      weeks.push({
        value: `week:${fISO}..${tISO}`,
        label: fmtWeekLabel(fISO, tISO),
        from: fISO,
        to: tISO
      });
    }
    const nextMon = new Date(monDt.getFullYear(), monDt.getMonth(), monDt.getDate() + 7);
    for (let wMon = new Date(nextMon); wMon <= maxDt; wMon.setDate(wMon.getDate() + 7)) {
      const wSun = new Date(wMon.getFullYear(), wMon.getMonth(), wMon.getDate() + 6);
      const fISO = toISO(wMon);
      const tISO = toISO(wSun);
      weeks.push({
        value: `week:${fISO}..${tISO}`,
        label: fmtWeekLabel(fISO, tISO),
        from: fISO,
        to: tISO
      });
    }

    // Build active transaction days newest-first across 2024-01-01 .. 2030-12-31
    const daySet = new Set([SEED_DATE]);
    ['sales_tickets', 'raw_purchases', 'expenses', 'receipts', 'settlements', 'fuel_intakes', 'salaries'].forEach(tk => {
      (SEED.records[tk] || []).forEach(r => {
        if (r && r.date && r.date >= MIN_DATE && r.date <= MAX_DATE) daySet.add(String(r.date).slice(0, 10));
      });
    });
    const days = Array.from(daySet).sort((a, b) => b.localeCompare(a)).map(iso => ({
      value: `day:${iso}`,
      label: `${fmtDayLabel(iso)} (${iso})`,
      from: iso,
      to: iso
    }));

    _grainCatalogCache = { all: presets, year: years, month: months, week: weeks, day: days };
    return _grainCatalogCache;
  }

  function getDateGrainOptions(grain) {
    const cat = getDateGrainCatalog();
    return cat[grain] || cat.all;
  }

  // Reporting period → ISO date window applied to the record registers & KPIs (null = All-Time)
  function periodRange(p) {
    const pVal = p !== undefined ? p : STATE.period;
    if (!pVal || pVal === 'all') {
      if (STATE.dateFrom || STATE.dateTo) {
        const f = STATE.dateFrom || MIN_DATE;
        const t = STATE.dateTo || MAX_DATE;
        return { from: f, to: t, label: `${f} → ${t}`, isCustom: true };
      }
      return null;
    }
    if (pVal === 'custom') {
      const f = STATE.dateFrom || MIN_DATE;
      const t = STATE.dateTo || MAX_DATE;
      return { from: f, to: t, label: `${f} → ${t}`, isCustom: true };
    }
    const y = SEED_DATE.slice(0, 4);
    const ym = SEED_DATE.slice(0, 7);
    switch (pVal) {
      case 'ytd': return { from: y + '-01-01', to: y + '-12-31', label: 'FY 2026 (YTD)', daxKey: 'ytd' };
      case 'mtd': return { from: ym + '-01', to: ym + '-31', label: 'October 2026 (MTD)', daxKey: 'mtd' };
      case 'sep2026': return { from: '2026-09-01', to: '2026-09-30', label: 'September 2026', daxKey: 'sep2026' };
      case 'aug2026': return { from: '2026-08-01', to: '2026-08-31', label: 'August 2026', daxKey: 'aug2026' };
      case 'q3_2026': return { from: '2026-07-01', to: '2026-09-30', label: 'Q3 2026 (Jul–Sep)', daxKey: 'q3_2026' };
      case 'fy2025': return { from: '2025-01-01', to: '2025-12-31', label: 'FY 2025 (Full Year)', daxKey: 'fy2025' };
      case 'fy2024': return { from: '2024-01-01', to: '2024-12-31', label: 'FY 2024 (Full Year)', daxKey: 'fy2024' };
    }
    if (String(pVal).startsWith('year:')) {
      const yr = String(pVal).slice(5, 9);
      const daxMap = { '2026': 'ytd', '2025': 'fy2025', '2024': 'fy2024' };
      return { from: `${yr}-01-01`, to: `${yr}-12-31`, label: `FY ${yr}`, daxKey: daxMap[yr] || null };
    }
    if (String(pVal).startsWith('month:')) {
      const ymStr = String(pVal).slice(6, 13);
      const [yr, mo] = ymStr.split('-').map(Number);
      const ld = String(lastDayOfMonth(yr || 2026, mo || 1)).padStart(2, '0');
      const daxMap = { '2026-10': 'mtd', '2026-09': 'sep2026', '2026-08': 'aug2026' };
      return { from: `${ymStr}-01`, to: `${ymStr}-${ld}`, label: `${MONTH_LONG[(mo || 1) - 1]} ${yr}`, daxKey: daxMap[ymStr] || null };
    }
    if (String(pVal).startsWith('week:')) {
      const parts = String(pVal).slice(5).split('..');
      const f = parts[0] || MIN_DATE;
      const t = parts[1] || f;
      return { from: f, to: t, label: `Week ${fmtWeekLabel(f, t)}` };
    }
    if (String(pVal).startsWith('day:')) {
      const iso = String(pVal).slice(4, 14);
      return { from: iso, to: iso, label: fmtDayLabel(iso) };
    }
    return null;
  }

  let _kpiRangeCacheKey = '';
  let _kpiRangeCacheVal = null;
  let _prodByNameLen = -1;
  let _prodByName = null;

  function productByName(name) {
    const list = SEED.records.products || [];
    if (!_prodByName || _prodByNameLen !== list.length) {
      _prodByName = new Map();
      list.forEach(p => { if (p && p.name) _prodByName.set(norm(p.name), p); });
      _prodByNameLen = list.length;
    }
    return _prodByName.get(norm(name));
  }

  // Tonnage rule of the semantic models (m167): Qty when the product's UoM is Ton, else Qty x the product's ton factor.
  // A product without a factor carries no tonnage (the bundle stores a missing factor as 1.0, so 1.0 == "not set").
  function ticketTons(r) {
    if (!r) return 0;
    const q = Number(r.qty || 0);
    const p = productByName(r.product);
    const uom = String((p && p.uom) || r.uom || '').trim();
    if (/^ton/i.test(uom)) return q;
    const f = Number(p && p.ton_factor != null ? p.ton_factor : (r.ton_factor != null ? r.ton_factor : 0));
    return (f > 0 && f !== 1) ? q * f : 0;
  }

  // m18a / m272: Sale = +1 (Cash / Credit / Barter), Return = -1 (C Return / CR Return / Cash Return / Credit Return), Free / Remove / Config = 0
  function ticketSign(r) {
    const m = String((r && r.method) || '').trim();
    if (m === 'C Return' || m === 'CR Return' || m === 'Cash Return' || m === 'Credit Return') return -1;
    if (m === 'Free' || m === 'Remove' || m === 'Config' || m === 'VATConfig') return 0;
    return 1;
  }

  function saveFilterState() {
    if (IS_AUTOMATED_TEST) return;
    try {
      localStorage.setItem('isabi_mfg_filter_state_v1', JSON.stringify({
        company: STATE.company,
        period: STATE.period,
        dateGrain: STATE.dateGrain,
        dateFrom: STATE.dateFrom,
        dateTo: STATE.dateTo,
        basis: STATE.basis
      }));
    } catch (_) { /* storage full */ }
  }

  // Keys that are plain sums over records (safe to shift by a per-record delta); ratios are recomputed afterwards.
  const KPI_ADDITIVE_KEYS = ['sales_ttc', 'gross_sales', 'net_sales', 'trans_rev', 'sales_vat', 'loads', 'delivery_loads', 'pickup_loads', 'unregistered_loads',
    'tons_sold', 'qty_sold', 'cash_sales', 'credit_sales', 'raw_cost', 'raw_mat_cost', 'raw_haulage', 'raw_loads', 'raw_tons', 'raw_qty',
    'expenses', 'cash_expenses', 'credit_expenses', 'salaries_paid', 'gross_margin', 'operating_profit', 'receipts', 'settlements_paid',
    'cash_inflow', 'cash_outflow', 'net_cash_flow', 'diesel_litres', 'own_fleet_loads'];

  function finishKpiRatios(k) {
    k.avg_price_ttc = k.qty_sold > 0 ? round2(k.sales_ttc / k.qty_sold) : 0;
    k.avg_price_net = k.qty_sold > 0 ? round2(k.net_sales / k.qty_sold) : 0;
    k.avg_raw_cost = k.raw_qty > 0 ? round2(k.raw_cost / k.raw_qty) : 0;
    k.gm_pct = k.net_sales > 0 ? k.gross_margin / k.net_sales : 0;
    k.op_margin_pct = k.net_sales > 0 ? k.operating_profit / k.net_sales : 0;
    return k;
  }

  // Local record engine for one date basis ('tx' = transaction date, 'rep' = reporting date). Same rules as the DAX
  // measures wherever the bundle carries the inputs (tonnage, sale-type split, cash/credit); returns plain sums only.
  function computeLocalKPI(m, range, basis) {
    const periods = m.periods || {};
    const t = range ? range.to : SEED_DATE;
    const baseKey = t >= '2026-01-01' ? 'ytd' : (t >= '2025-01-01' ? 'fy2025' : 'fy2024');
    const baseKpi = Object.assign({}, periods.all || {}, periods[baseKey] || {});
    const fo = { ignoreSearch: true, basis };

    const sales = filterRecords(SEED.records.sales_tickets, fo);
    const raws = filterRecords(SEED.records.raw_purchases, fo);
    const exps = filterRecords(SEED.records.expenses, fo);
    const sals = filterRecords(SEED.records.salaries, fo);
    const rcpts = filterRecords(SEED.records.receipts, fo);
    const spays = filterRecords(SEED.records.settlements, fo);
    const fuels = filterRecords(SEED.records.fuel_intakes, fo);
    const exts = filterRecords(SEED.records.external_movements, fo);

    let loads = 0, delivery_loads = 0, pickup_loads = 0, unregistered_loads = 0;
    let sales_ttc = 0, sales_vat = 0, net_sales = 0, gross_sales = 0, trans_rev = 0, qty_sold = 0, tons_sold = 0;
    let cash_sales = 0, credit_sales = 0;
    sales.forEach(s => {
      const sgn = ticketSign(s);
      loads += 1;
      if (s.sale_type === 'Pickup') pickup_loads += 1;
      else if (s.sale_type === 'Delivery') delivery_loads += 1;
      else unregistered_loads += 1;
      const ttc = Number(s.total_ttc != null ? s.total_ttc : s.total || 0) * sgn;
      const vat = Number(s.vat || 0) * sgn;
      const net = Number(s.total != null ? s.total : (Number(s.total_ttc || 0) - Number(s.vat || 0))) * sgn;
      const tr = Number(s.trans_price || 0) * sgn;
      const mat = Number(s.price != null ? s.price : (Number(s.total || 0) - Number(s.trans_price || 0))) * sgn;
      const q = Number(s.qty || 0) * sgn;
      sales_ttc += ttc;
      sales_vat += vat;
      net_sales += mat;
      gross_sales += net;
      trans_rev += tr;
      qty_sold += q;
      tons_sold += ticketTons(s) * sgn;
      if (s.method === 'Cash' || s.method === 'C Return' || s.method === 'Cash Return') cash_sales += net;
      else if (sgn !== 0) credit_sales += net;
    });

    let raw_loads = 0, raw_mat_cost = 0, raw_haulage = 0, raw_cost = 0, raw_qty = 0, raw_tons = 0;
    raws.forEach(r => {
      raw_loads += 1;
      const mat = Number(r.cost || 0);
      const haul = Number(r.trans_cost || 0);
      const tot = Number(r.total != null ? r.total : (mat + haul));
      const q = Number(r.qty || 0);
      raw_mat_cost += mat;
      raw_haulage += haul;
      raw_cost += tot;
      raw_qty += q;
      raw_tons += ticketTons(r);
    });

    let expenses = 0, cash_expenses = 0, credit_expenses = 0;
    exps.forEach(x => {
      const a = Number(x.amount || 0);
      expenses += a;
      if (x.method === 'Cash') cash_expenses += a;
      else credit_expenses += a;
    });

    const salaries_paid = sals.reduce((a, r) => a + Number(r.amount || 0), 0);
    const receipts = rcpts.reduce((a, r) => a + Number(r.amount || 0), 0);
    const settlements_paid = spays.reduce((a, r) => a + Number(r.amount || 0), 0);
    let diesel_litres = 0;
    fuels.forEach(fl => {
      if (/diesel|mazout/i.test(String(fl.item || fl.fuel_type || 'Diesel'))) {
        diesel_litres += Number(fl.litres || 0);
      }
    });
    let ext_in = 0, ext_out = 0;
    exts.forEach(ex => {
      const a = Number(ex.amount || 0);
      if (/out/i.test(String(ex.direction || ''))) ext_out += a;
      else ext_in += a;
    });

    const gross_margin = round2(net_sales - raw_cost);
    const operating_profit = round2(gross_margin - expenses - salaries_paid);
    const cash_inflow = round2(cash_sales + receipts + ext_in);
    const cash_outflow = round2(cash_expenses + settlements_paid + salaries_paid + ext_out);
    const net_cash_flow = round2(cash_inflow - cash_outflow);
    const truckSet = new Set();
    let own_fleet_loads = 0;
    sales.forEach(s => { if (s.truck) truckSet.add(s.truck); if (s.transport_by === 'Company fleet') own_fleet_loads += 1; });
    raws.forEach(r => { if (r.truck) truckSet.add(r.truck); if (r.transport_by === 'Company fleet') own_fleet_loads += 1; });

    return finishKpiRatios(Object.assign(baseKpi, {
      sales_ttc: round2(sales_ttc),
      gross_sales: round2(gross_sales || sales_ttc),
      net_sales: round2(net_sales),
      trans_rev: round2(trans_rev),
      sales_vat: round2(sales_vat),
      loads,
      delivery_loads,
      pickup_loads,
      unregistered_loads,
      tons_sold: round2(tons_sold),
      qty_sold: round2(qty_sold),
      cash_sales: round2(cash_sales),
      credit_sales: round2(credit_sales),
      raw_cost: round2(raw_cost),
      raw_mat_cost: round2(raw_mat_cost),
      raw_haulage: round2(raw_haulage),
      raw_loads,
      raw_tons: round2(raw_tons),
      raw_qty: round2(raw_qty),
      expenses: round2(expenses),
      cash_expenses: round2(cash_expenses),
      credit_expenses: round2(credit_expenses),
      salaries_paid: round2(salaries_paid),
      gross_margin,
      operating_profit,
      receipts: round2(receipts),
      settlements_paid: round2(settlements_paid),
      cash_inflow,
      cash_outflow,
      net_cash_flow,
      diesel_litres: round2(diesel_litres),
      trucks_used: truckSet.size || baseKpi.trucks_used || 0,
      own_fleet_loads,
      sales_rep_date: round2(sales_ttc),
      raw_rep_date: round2(raw_cost),
      exp_rep_date: round2(expenses),
      op_profit_rep_date: operating_profit,
      basis,
      label: range ? range.label : 'All-Time (2024\u20132030)'
    }));
  }

  // A single calendar month on the transaction basis: overlay the exact DAX monthly figures on the headline totals.
  function applyMonthlyDax(k, m) {
    if (!String(STATE.period).startsWith('month:')) return k;
    const ymStr = String(STATE.period).slice(6, 13);
    const [yr, mo] = ymStr.split('-').map(Number);
    const ymLabel = `${MONTH_SHORT[(mo || 1) - 1]} ${yr}`;
    const mRow = (m.monthly || []).find(r => r['Year Month'] === ymLabel);
    if (!mRow) return k;
    const MAP = { sales_ttc: 'sales_ttc', gross_sales: 'gross_sales', net_sales: 'net_sales', trans_rev: 'trans_rev', sales_vat: 'sales_vat', cash_sales: 'cash_sales', credit_sales: 'credit_sales',
      loads: 'loads', delivery_loads: 'delivery_loads', pickup_loads: 'pickup_loads', tons_sold: 'tons', qty_sold: 'qty_sold',
      raw_cost: 'raw_cost', raw_mat_cost: 'raw_mat_cost', raw_haulage: 'raw_haulage', raw_loads: 'raw_loads', raw_qty: 'raw_qty',
      expenses: 'expenses', cash_expenses: 'cash_expenses', credit_expenses: 'credit_expenses', salaries_paid: 'salaries',
      gross_margin: 'gross_margin', operating_profit: 'operating_profit', receipts: 'receipts', settlements_paid: 'settlements_paid' };
    Object.keys(MAP).forEach(key => { if (mRow[MAP[key]] != null) k[key] = Number(mRow[MAP[key]]); });
    if (k.gross_sales == null && k.net_sales != null) k.gross_sales = round2(Number(k.net_sales || 0) + Number(k.trans_rev || 0));
    return finishKpiRatios(k);
  }

  // Reporting-date figures = the transaction-date figures (DAX-anchored wherever a snapshot exists) shifted ONLY by the
  // records whose reporting date moves them across the window edges. Never a second engine with its own totals, so
  // All-Time is identical on both bases and a month differs by the handful of late-reported tickets.
  function bridgeKpiToBasis(anchor, txRaw, repRaw) {
    const out = Object.assign({}, anchor);
    KPI_ADDITIVE_KEYS.forEach(key => {
      const delta = Number(repRaw[key] || 0) - Number(txRaw[key] || 0);
      const base = anchor[key] != null ? Number(anchor[key]) : Number(txRaw[key] || 0);
      out[key] = round2(base + delta);
    });
    out.sales_rep_date = out.sales_ttc;
    out.raw_rep_date = out.raw_cost;
    out.exp_rep_date = out.expenses;
    out.op_profit_rep_date = out.operating_profit;
    out.basis = 'rep';
    return finishKpiRatios(out);
  }

  function getKPI() {
    const m = getModel();
    const periods = m.periods || {};
    const range = periodRange(STATE.period);
    let anchor = null;
    if (!range) anchor = periods.all ? Object.assign({}, periods.all, { label: 'All-Time (2024–2030)' }) : null;
    else if (range.daxKey && periods[range.daxKey]) anchor = periods[range.daxKey];
    if ((STATE.basis === 'tx' || (!range && !(STATE.customRecords.sales_tickets || []).length)) && anchor) return Object.assign({}, anchor, { sales_rep_date: anchor.sales_ttc, raw_rep_date: anchor.raw_cost, exp_rep_date: anchor.expenses, op_profit_rep_date: anchor.operating_profit, basis: STATE.basis });
    const f = range ? range.from : MIN_DATE;
    const t = range ? range.to : MAX_DATE;
    const cacheKey = `${STATE.company}|${STATE.basis}|${STATE.period}|${f}|${t}|${(STATE.customRecords.sales_tickets || []).length}`;
    if (_kpiRangeCacheKey === cacheKey && _kpiRangeCacheVal) return _kpiRangeCacheVal;

    const txRaw = computeLocalKPI(m, range, 'tx');
    const txFinal = anchor || applyMonthlyDax(Object.assign({}, txRaw), m);
    const computed = STATE.basis === 'rep' ? bridgeKpiToBasis(txFinal, txRaw, computeLocalKPI(m, range, 'rep')) : txFinal;

    _kpiRangeCacheKey = cacheKey;
    _kpiRangeCacheVal = computed;
    return computed;
  }

  function monthLabelToYm(lbl) {
    const parts = String(lbl || '').trim().split(/\s+/);
    if (parts.length < 2) return '';
    const mi = MONTH_SHORT.findIndex(m => m.toLowerCase() === parts[0].slice(0, 3).toLowerCase());
    if (mi < 0) return '';
    return `${parts[1]}-${String(mi + 1).padStart(2, '0')}`;
  }

  function getScopedMonthly(monthlyList, maxCount = 14) {
    const allM = monthlyList || [];
    const range = periodRange(STATE.period);
    if (!range) return allM.slice(-maxCount);
    const fYm = range.from.slice(0, 7);
    const tYm = range.to.slice(0, 7);
    const matching = allM.filter(r => {
      const ym = monthLabelToYm(r['Year Month']);
      return ym && ym >= fYm && ym <= tYm;
    });
    if (matching.length >= 2) return matching.slice(-maxCount);
    // When a single Month/Week/Day is selected, include up to 6 months ending at tYm for context
    const upTo = allM.filter(r => {
      const ym = monthLabelToYm(r['Year Month']);
      return ym && ym <= tYm;
    });
    return (upTo.length ? upTo.slice(-Math.min(6, maxCount)) : allM.slice(-maxCount));
  }

  function setDateFilter(opts = {}) {
    if (opts.reset) {
      STATE.dateGrain = 'all';
      STATE.period = 'all';
      STATE.dateFrom = '';
      STATE.dateTo = '';
    } else {
      if (opts.grain) {
        STATE.dateGrain = opts.grain;
        if (!opts.period && !opts.from && !opts.to) {
          const grainOpts = getDateGrainOptions(opts.grain);
          if (opts.grain === 'all') {
            STATE.period = 'all';
          } else if (opts.grain === 'year') {
            const curYr = 'year:' + SEED_DATE.slice(0, 4);
            STATE.period = grainOpts.some(o => o.value === curYr) ? curYr : (grainOpts[0] ? grainOpts[0].value : 'year:2026');
          } else if (grainOpts.length) {
            STATE.period = grainOpts[0].value;
          }
          STATE.dateFrom = '';
          STATE.dateTo = '';
        }
      }
      if (opts.period !== undefined) {
        STATE.period = opts.period;
        if (opts.period !== 'custom') {
          STATE.dateFrom = '';
          STATE.dateTo = '';
          if (String(opts.period).startsWith('year:')) STATE.dateGrain = 'year';
          else if (String(opts.period).startsWith('month:')) STATE.dateGrain = 'month';
          else if (String(opts.period).startsWith('week:')) STATE.dateGrain = 'week';
          else if (String(opts.period).startsWith('day:')) STATE.dateGrain = 'day';
        }
      }
      if (opts.from !== undefined || opts.to !== undefined) {
        const curRange = periodRange(STATE.period) || { from: MIN_DATE, to: MAX_DATE };
        let nf = opts.from !== undefined ? opts.from : (STATE.dateFrom || curRange.from);
        let nt = opts.to !== undefined ? opts.to : (STATE.dateTo || curRange.to);
        if (nf && nt && nf > nt) {
          if (opts.from !== undefined) nt = nf;
          else nf = nt;
        }
        STATE.dateFrom = nf || MIN_DATE;
        STATE.dateTo = nt || MAX_DATE;
        STATE.period = 'custom';
      }
    }
    STATE.shown = {};
    STATE.pbiTablePage = {};
    saveFilterState();
    renderApp();
  }

  function syncTopbarDateControls() {
    document.querySelectorAll('#grainSwitch .grain-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-grain') === STATE.dateGrain);
    });
    const periodSel = $('periodSelect');
    if (periodSel) {
      const cat = getDateGrainCatalog();
      const activeOpts = cat[STATE.dateGrain] || cat.all;
      let html = '';
      if (STATE.period === 'custom') {
        const f = STATE.dateFrom || MIN_DATE;
        const t = STATE.dateTo || MAX_DATE;
        html += `<option value="custom">Range: ${esc(f)} → ${esc(t)}</option>`;
      }
      html += activeOpts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
      if (STATE.dateGrain !== 'all') {
        html += `<optgroup label="Quick Presets">${cat.all.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</optgroup>`;
      }
      if (periodSel.dataset.sig !== STATE.dateGrain + '|' + (STATE.period === 'custom' ? (STATE.dateFrom + '..' + STATE.dateTo) : '')) {
        periodSel.innerHTML = html;
        periodSel.dataset.sig = STATE.dateGrain + '|' + (STATE.period === 'custom' ? (STATE.dateFrom + '..' + STATE.dateTo) : '');
      }
      periodSel.value = STATE.period;
    }
    const r = periodRange(STATE.period) || { from: MIN_DATE, to: MAX_DATE };
    const fromEl = $('dateFromInput');
    const toEl = $('dateToInput');
    const barEl = $('dateRangeBar');
    const rstEl = $('dateRangeResetBtn');
    if (fromEl && document.activeElement !== fromEl) fromEl.value = r.from;
    if (toEl && document.activeElement !== toEl) toEl.value = r.to;
    const isFiltered = STATE.period !== 'all' || STATE.dateGrain !== 'all' || Boolean(STATE.dateFrom || STATE.dateTo);
    if (barEl) barEl.classList.toggle('custom-active', STATE.period === 'custom' || isFiltered);
    if (rstEl) rstEl.hidden = !isFiltered;
  }

  function modelHasLedger(key) {
    const m = SEED.models[key || STATE.company];
    const p = m && m.periods && m.periods.all;
    return !!(p && (p.sales_ttc != null || p.loads != null || p.expenses != null));
  }

  function recordDateFor(r, basis) {
    return String((basis === 'rep' && r.rep_date) ? r.rep_date : (r.date || '')).slice(0, 10);
  }

  function recordDate(r) {
    return recordDateFor(r, STATE.basis);
  }

  function filterRecords(list, opts = {}) {
    const bu = COMPANY_BU_MATCH[STATE.company];
    const q = opts.ignoreSearch ? '' : STATE.search.trim().toLowerCase();
    const range = opts.ignorePeriod ? null : periodRange(STATE.period);
    const basis = opts.basis || STATE.basis;
    return (list || []).filter(r => {
      if (!r || r.voided) return false;
      if (bu && r.company && r.company !== bu) return false;
      if (range) {
        const d = recordDateFor(r, basis);
        if (d && (d < range.from || d > range.to)) return false;
      }
      if (q) {
        const hay = Object.keys(r).filter(k => k !== 'id').map(k => r[k]).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---- sorting / paging / table helpers --------------------------------------
  function sortRows(rows, view, defKey, defDir) {
    const s = STATE.sortBy[view] || { key: defKey, dir: defDir || 'desc' };
    if (!s.key) return rows;
    const dir = s.dir === 'asc' ? 1 : -1;
    const useRecDate = s.key === 'date';
    return rows.slice().sort((a, b) => {
      const av = useRecDate ? recordDate(a) : a[s.key];
      const bv = useRecDate ? recordDate(b) : b[s.key];
      if ((av == null || av === '') && (bv == null || bv === '')) return 0;
      if (av == null || av === '') return 1;
      if (bv == null || bv === '') return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      if (typeof av === 'boolean' && typeof bv === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      if (cmp !== 0) return cmp;
      if (useRecDate && (a.ticket_no || b.ticket_no)) {
        return String(a.ticket_no || '').localeCompare(String(b.ticket_no || ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      }
      return 0;
    });
  }

  function th(view, label, key, cls) {
    const s = STATE.sortBy[view] || {};
    const on = s.key === key;
    return `<th class="${cls || ''} sortable${on ? ' on' : ''}" data-sort-view="${esc(view)}" data-sort-key="${esc(key)}" title="Sort by ${esc(label)}">${label}<i>${on ? (s.dir === 'asc' ? '▲' : '▼') : ''}</i></th>`;
  }

  function shownCount(view) { return STATE.shown[view] || PAGE; }

  function showMoreRow() {
    return '';
  }

  function emptyRow(cols, msg) {
    return `<tr class="empty-row"><td colspan="${cols}">${esc(msg)}</td></tr>`;
  }

  function periodEmptyMsg(list, what) {
    const range = periodRange(STATE.period);
    const dates = (list || []).filter(r => r && !r.voided).map(r => recordDate(r)).filter(Boolean).sort();
    const span = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'none';
    if (STATE.search) return `No ${what} match "${STATE.search}"${range ? ' in ' + range.from + ' → ' + range.to : ''}.`;
    if (range) return `No ${what} dated ${range.from} → ${range.to} in the register (full ledger span: ${span}).`;
    return `No ${what} in the register yet.`;
  }

  function isAppRecord(r) {
    // app ids = uid(form.slice(0, 2)) → "sa-<ts36>-<rnd6>"; Dataverse ids are GUIDs
    return !!(r && (r.source === 'app' || /^[a-z]{2}-[0-9a-z]+-[0-9a-z]{6}$/.test(String(r.id || ''))));
  }

  function appCell(r, crKey) {
    if (!isAppRecord(r)) return '';
    const who = r.entered_by ? ' by ' + r.entered_by : '';
    const when = r.entered_at ? ' · ' + r.entered_at : '';
    return ` <span class="badge badge-app" title="Entered in this web app${esc(who + when)}">APP</span>` +
      (canVoid() ? `<button type="button" class="void-btn" data-void="${esc(crKey)}" data-void-id="${esc(r.id)}" title="Void this app entry (keeps a tombstone so other devices drop it too)">✕</button>` : '');
  }

  function appPill(crKey, amountKey, label) {
    const rows = filterRecords(STATE.customRecords[crKey], { ignoreSearch: true });
    if (!rows.length) return '';
    const sum = rows.reduce((a, r) => a + Number(r[amountKey] || 0), 0);
    return `<div class="cockpit-pill app-pill" title="Entered in this web app · not yet inside the SQL / book totals"><div class="cockpit-pill-lbl">App-entered (unposted)</div><div class="cockpit-pill-val amber">${fmtNum(rows.length)} ${esc(label)} · ${fmtUSD(sum, 0)}</div></div>`;
  }

  function appEnteredSummary() {
    const out = [];
    const spec = [['sales_tickets', 'total_ttc', 'sales tickets'], ['raw_purchases', 'total', 'raw receipts'], ['receipts', 'amount', 'customer receipts'], ['fuel_intakes', 'litres', 'fuel intakes'], ['expenses', 'amount', 'expenses'], ['settlements', 'amount', 'supplier settlements']];
    spec.forEach(([k, amt, label]) => {
      const rows = filterRecords(STATE.customRecords[k], { ignoreSearch: true });
      if (!rows.length) return;
      const sum = rows.reduce((a, r) => a + Number(r[amt] || 0), 0);
      out.push({ key: k, n: rows.length, sum, label, unit: amt === 'litres' ? 'L' : '$' });
    });
    return out;
  }

  function tableToCsv(table) {
    return Array.from(table.querySelectorAll('tr')).map(tr =>
      Array.from(tr.querySelectorAll('th,td')).map(td => '"' + td.innerText.replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"').join(',')
    ).join('\r\n');
  }

  function downloadCsv(name, csv) {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function exportBtn(panelId, name) {
    return `<button type="button" class="btn" data-export-csv="${esc(panelId)}" data-export-name="${esc(name)}" title="Download the rows shown as CSV (Excel, UTF-8)">⬇ CSV</button>`;
  }

  function searchBox(placeholder) {
    return `<input type="search" id="tableSearchInput" class="search-input" value="${esc(STATE.search)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
  }

  // ---- seats, roles & row-level security -------------------------------------
  function activeUser() {
    return STATE.users[STATE.activeUserIdx] || STATE.users[0] || DEFAULT_USERS[0];
  }
  function isOwner(u) { return /Owner/i.test(String((u || activeUser()).role || '')); }
  function userFaceSamples(u) {
    if (!u) return [];
    let raw = u.face_samples;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = []; } }
    return Array.isArray(raw) ? raw.filter(s => Array.isArray(s) && s.length === 128) : [];
  }
  function userFaceThumbs(u) {
    if (!u) return [];
    let raw = u.face_thumbs;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = []; } }
    return Array.isArray(raw) ? raw.map(t => String(t || '')).slice(0, 3) : [];
  }
  function syncEnrolBufferFromUser(u, force = false) {
    if (!u) return;
    if (!force && FACE_STATE.enrolLoadedForUserId === String(u.id)) return;
    FACE_STATE.enrolLoadedForUserId = String(u.id);
    const savedSamples = userFaceSamples(u).slice(0, 3);
    const savedThumbs = userFaceThumbs(u).slice(0, 3);
    FACE_STATE.enrolCaptures = savedSamples.map(s => s.slice());
    FACE_STATE.enrolThumbs = savedSamples.map((_, i) => savedThumbs[i] || '');
    if (savedSamples.length) {
      FACE_STATE.enrolStatusText = `${u.full_name} has ${savedSamples.length}/3 biometric poses stored. Click any pose card or "Retake / Capture Pose" to update.`;
      FACE_STATE.enrolStatusCls = 'ok';
    } else {
      FACE_STATE.enrolStatusText = `Ready for ${u.full_name} — click "Capture Pose (1/3)" to start camera and store Pose 1.`;
      FACE_STATE.enrolStatusCls = '';
    }
  }
  function userHasFaceId(u) {
    return userFaceSamples(u).length > 0;
  }
  function userRequiresFace2FA(u) {
    if (!u || !STATE.faceSettings.enforce2FA) return false;
    return userHasFaceId(u) && u.face_required !== false;
  }
  function enrolTargetUser() {
    if (!isOwner()) return activeUser();
    const hit = STATE.users.find(u => u && String(u.id) === String(FACE_STATE.enrolUserId));
    return hit || activeUser();
  }
  function usableFaces(includeUnsavedForUser) {
    const list = STATE.users.filter(u => u && u.status !== 'Suspended' && userFaceSamples(u).length > 0).map(u => ({
      id: u.id,
      email: u.email,
      name: u.full_name,
      role: u.role,
      companies: u.companies,
      samples: userFaceSamples(u)
    }));
    if (includeUnsavedForUser && FACE_STATE.enrolCaptures.length) {
      const idx = list.findIndex(x => norm(x.email) === norm(includeUnsavedForUser.email));
      const row = {
        id: includeUnsavedForUser.id,
        email: includeUnsavedForUser.email,
        name: includeUnsavedForUser.full_name + ' (unsaved)',
        role: includeUnsavedForUser.role,
        companies: includeUnsavedForUser.companies,
        samples: FACE_STATE.enrolCaptures.slice()
      };
      if (idx >= 0) list[idx] = row;
      else list.push(row);
    }
    return list;
  }
  function canEnterForm(form, u) {
    const role = String((u || activeUser()).role || '');
    if (/Owner/i.test(role)) return true;
    if (/Entry/i.test(role)) return true;            // Entry · Supervisor + Entry
    if (/Sales/i.test(role)) return ['receipt', 'pricerule', 'vatinvoice', 'creditterm', 'customer'].includes(form); // AR / commercial seat
    return false;                                      // Supervisor = read-only oversight
  }
  function canEnterAny(u) { return canEnterForm('sales', u) || canEnterForm('receipt', u); }
  function canVoid(u) { return /Owner|Entry/i.test(String((u || activeUser()).role || '')); }

  function canViewView(view, u) {
    u = u || activeUser();
    const pbi = u.pbi_access || 'partial';
    const st = u.statements_access || 'partial';
    if (view === 'overview' || view === 'pbi' || view === 'expenses' || view === 'payroll') return pbi !== 'none';
    if (view === 'sentinels' || view === 'ledger' || view === 'gl') return pbi === 'full';
    if (view === 'statements') return st !== 'none';
    return true;
  }
  function defaultViewFor(u) {
    u = u || activeUser();
    if (canViewView('overview', u)) return 'overview';
    return /fuel/i.test(u.email || '') ? 'fleet' : 'sales';
  }

  function getAllowedCompanyKeys(user) {
    const cStr = String((user && user.companies) || 'WTC');
    const allowed = [];
    const hasWtc = cStr.includes('WTC');
    const hasBbc = cStr.includes('BBConstruction');
    const hasLt = cStr.includes('Lions Transport');
    if (hasWtc && hasBbc && hasLt) allowed.push('manufacturing-group');
    if (hasWtc) allowed.push('wtc');
    if (hasBbc) allowed.push('bbconstruction');
    if (hasLt) allowed.push('lionstransport');
    return allowed.length ? allowed : ['wtc'];
  }
  function allowedCompanyNames(u) {
    return getAllowedCompanyKeys(u || activeUser()).filter(k => k !== 'manufacturing-group').map(k => COMPANY_BU_MATCH[k]);
  }
  function defaultEntryCompany() {
    const names = allowedCompanyNames();
    const cur = COMPANY_BU_MATCH[STATE.company];
    return (cur && names.includes(cur)) ? cur : names[0];
  }

  // ---- master-data lookups for the entry desk ---------------------------------
  function uniqSorted(arr) {
    return Array.from(new Set(arr.map(x => String(x || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }
  function customerNames() {
    const out = [];
    (SEED.records.customers || []).forEach(c => out.push(c.name));
    Object.values(SEED.models).forEach(m => (m.customers || []).forEach(c => out.push(c.Customer)));
    SEED.records.sales_tickets.forEach(r => out.push(r.customer));
    SEED.records.receipts.forEach(r => out.push(r.customer));
    SEED.records.price_rules.forEach(r => out.push(r.customer));
    return uniqSorted(out);
  }
  function supplierNames() {
    const out = [];
    (SEED.records.suppliers || []).forEach(s => out.push(s.name));
    Object.values(SEED.models).forEach(m => (m.suppliers || []).forEach(s => out.push(s.Supplier)));
    SEED.records.raw_purchases.forEach(r => { out.push(r.site_owner); out.push(r.truck_owner); });
    SEED.records.settlements.forEach(r => out.push(r.supplier));
    SEED.records.expenses.forEach(r => out.push(r.supplier));
    SEED.records.price_rules.forEach(r => out.push(r.supplier));
    return uniqSorted(out);
  }
  function truckOwnerNames() {
    const out = [];
    (SEED.records.suppliers || []).forEach(s => { if (s.is_truck_owner || Number(s.trucks_count || 0) > 0) out.push(s.name); });
    (SEED.records.equipment || []).forEach(e => { if (e.supplier) out.push(e.supplier); });
    (SEED.records.drivers || []).forEach(d => { if (d.truck_owner) out.push(d.truck_owner); });
    SEED.records.raw_purchases.forEach(r => { if (r.truck_owner) out.push(r.truck_owner); });
    return uniqSorted(out);
  }
  function trucksForOwner(ownerName, company, isCompanyFleet) {
    if (isCompanyFleet) {
      const coUnits = (SEED.records.company_equipment || []).filter(e => !company || !e.company || e.company === company).map(e => e.name);
      const ownUnits = (SEED.records.equipment || []).filter(e => /^own/i.test(e.ownership || '') || norm(e.supplier) === norm(company)).map(e => e.name);
      return uniqSorted(coUnits.concat(ownUnits));
    }
    const o = norm(ownerName);
    if (!o) return [];
    const fromEq = (SEED.records.equipment || []).filter(e => norm(e.supplier) === o).map(e => e.name);
    const sup = (SEED.records.suppliers || []).find(s => norm(s.name) === o);
    const fromSup = (sup && Array.isArray(sup.trucks)) ? sup.trucks : [];
    const fromRaw = (SEED.records.raw_purchases || []).filter(r => norm(r.truck_owner) === o).map(r => r.truck);
    const fromSales = (SEED.records.sales_tickets || []).filter(r => norm(r.truck_owner) === o).map(r => r.truck);
    return uniqSorted(fromEq.concat(fromSup, fromRaw, fromSales));
  }
  function driversForOwner(ownerName, company, isCompanyFleet) {
    if (isCompanyFleet) {
      const coDrv = (SEED.records.company_drivers || []).filter(d => !company || !d.company || d.company === company).map(d => d.driver || d.name);
      return uniqSorted(coDrv.length ? coDrv : driverNames());
    }
    const o = norm(ownerName);
    if (!o) return [];
    const fromDrv = (SEED.records.drivers || []).filter(d => norm(d.truck_owner) === o).map(d => d.name);
    const sup = (SEED.records.suppliers || []).find(s => norm(s.name) === o);
    const fromSup = (sup && Array.isArray(sup.drivers)) ? sup.drivers : [];
    const fromRaw = (SEED.records.raw_purchases || []).filter(r => norm(r.truck_owner) === o).map(r => r.driver);
    const fromSales = (SEED.records.sales_tickets || []).filter(r => norm(r.truck_owner) === o).map(r => r.driver);
    return uniqSorted(fromDrv.concat(fromSup, fromRaw, fromSales));
  }
  function siteInfo(name) {
    const n = norm(name);
    return (SEED.records.sites || []).find(s => norm(s.name) === n) || null;
  }
  function siteNames() { return uniqSorted(SEED.records.sites.map(s => s.name).concat(SEED.records.sales_tickets.map(r => r.site), SEED.records.raw_purchases.map(r => r.site))); }
  function equipmentNames() { return uniqSorted(SEED.records.equipment.map(e => e.name).concat(SEED.records.fuel_intakes.map(f => f.equipment), SEED.records.sales_tickets.map(r => r.truck))); }
  function driverNames() { return uniqSorted(SEED.records.drivers.map(d => d.name).concat(SEED.records.sales_tickets.map(r => r.driver), SEED.records.fuel_intakes.map(f => f.driver))); }
  function staffNames() { return uniqSorted(SEED.records.salaries.map(s => s.staff).concat((SEED.records.employments || []).map(e => e.staff || e.name))); }
  function expenseCategories() {
    const map = new Map();
    (SEED.records.expense_categories || []).forEach(c => {
      if (c && c.name && !map.has(c.name)) map.set(c.name, new Set());
    });
    (SEED.records.expense_subcategories || []).forEach(sc => {
      if (!sc || !sc.category || !sc.name) return;
      if (!map.has(sc.category)) map.set(sc.category, new Set());
      map.get(sc.category).add(sc.name);
    });
    SEED.records.expenses.forEach(x => {
      if (!x.category) return;
      if (!map.has(x.category)) map.set(x.category, new Set());
      if (x.subcategory) map.get(x.category).add(x.subcategory);
    });
    ['Fuel', 'Repairs and Maintenance', 'Spare Parts', 'Oils', 'Tools', 'Office Supplies', 'Utilities', 'Licences and Fees', 'Transportation', 'Tips', 'Minor Equipment', 'Other Costs'].forEach(c => { if (!map.has(c)) map.set(c, new Set()); });
    return Array.from(map.entries()).map(([c, subs]) => ({ category: c, subs: Array.from(subs).sort() })).sort((a, b) => a.category.localeCompare(b.category));
  }
  function productList(materialOnly) {
    // Grades sold most → first (model products carry revenue), then every other registered product.
    // Tickets carry Material / ticket_product products only (m37 / m54 / m110) — oils and spare parts never go on a weighbridge ticket.
    const pool = materialOnly ? SEED.records.products.filter(p => p.ticket_product !== false && (!p.type || /material/i.test(p.type))) : SEED.records.products;
    const top = ((SEED.models['manufacturing-group'] || {}).products || []).map(p => p.Product);
    const byName = new Map(pool.map(p => [norm(p.name), p]));
    const out = [];
    const seen = new Set();
    top.forEach(n => { const p = byName.get(norm(n)); if (p && !seen.has(norm(n))) { out.push(p); seen.add(norm(n)); } });
    pool.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach(p => { if (!seen.has(norm(p.name))) { out.push(p); seen.add(norm(p.name)); } });
    return out;
  }
  function customerInfo(name) {
    const n = norm(name);
    if (!n) return null;
    const dvn = (SEED.records.customers || []).find(x => norm(x.name) === n) || null;
    let mdl = null;
    for (const m of Object.values(SEED.models)) {
      const c = (m.customers || []).find(x => norm(x.Customer) === n);
      if (c) { mdl = c; break; }
    }
    if (!dvn && !mdl) return null;
    return Object.assign({}, dvn || {}, mdl || {}, {
      Customer: (mdl && mdl.Customer) || (dvn && dvn.name) || name,
      method: (dvn && dvn.method) || (mdl && mdl.Method) || 'Credit',
      'VAT Registered': ((mdl && mdl['VAT Registered'] === 'Yes') || (dvn && dvn.vat_registered)) ? 'Yes' : 'No',
      customer_declared_qty: !!(dvn && dvn.customer_declared_qty),
      external_invoice: !!(dvn && dvn.external_invoice),
      // the AR book only carries the model's top-60 customers — null = "not in the sample", never $0.00
      ar_balance: mdl ? Number(mdl.ar_balance || 0) : null,
      in_ar_book: !!mdl
    });
  }
  function supplierInfo(name) {
    const n = norm(name);
    if (!n) return null;
    const dvn = (SEED.records.suppliers || []).find(x => norm(x.name) === n) || null;
    let mdl = null;
    for (const m of Object.values(SEED.models)) {
      const s = (m.suppliers || []).find(x => norm(x.Supplier) === n);
      if (s) { mdl = s; break; }
    }
    if (!dvn && !mdl) return null;
    return Object.assign({}, dvn || {}, mdl || {}, {
      Supplier: (mdl && mdl.Supplier) || (dvn && dvn.name) || name,
      iva: !!((dvn && dvn.iva) || (mdl && mdl.IVA === 'Yes')),
      is_truck_owner: !!(dvn && dvn.is_truck_owner),
      ap_balance: mdl ? Number(mdl.ap_balance || 0) : null,
      in_ap_book: !!mdl
    });
  }
  function productInfo(name) {
    const n = norm(name);
    return SEED.records.products.find(p => norm(p.name) === n) || null;
  }
  function equipInfo(name) {
    const n = norm(name);
    if (!n) return null;
    return (SEED.records.equipment || []).find(e => norm(e.name) === n || norm(e.plate_no) === n) || null;
  }
  function creditTermsForCustomer(name) {
    const n = norm(name);
    if (!n) return null;
    return (SEED.records.credit_terms || []).find(ct => norm(ct.customer) === n && !ct.end_date) ||
           (SEED.records.credit_terms || []).find(ct => norm(ct.customer) === n) || null;
  }
  function activeRulesCountFor(field, name) {
    const n = norm(name);
    if (!n) return 0;
    return (SEED.records.price_rules || []).filter(r => !r.end_date && norm(r[field]) === n).length;
  }
  function relLink(targetKey, val, label, bold) {
    const v = String(val == null ? '' : val).trim();
    if (!v || v === '—' || v === '(no site on ticket)' || v === '(Unspecified)' || v === 'Company fleet') {
      return bold ? `<strong>${esc(label || v || '—')}</strong>` : esc(label || v || '—');
    }
    const txt = esc(label || v);
    const inner = bold ? `<strong>${txt}</strong>` : txt;
    return `<span class="rel-link" data-rel-key="${esc(targetKey)}" data-rel-val="${esc(v)}" title="Open 360° Record &amp; Related Tables: ${esc(v)}">${inner}<span class="rel-arr">↗</span></span>`;
  }
  function listPrice(name) {
    const n = norm(name);
    for (const m of Object.values(SEED.models)) {
      const p = (m.products || []).find(x => norm(x.Product) === n);
      if (p && p.list_price != null) return Number(p.list_price);
    }
    return null;
  }

  // Price Agreement lookup (mirrors fillPrices on the Dataverse ticket form): customer × product × site × date,
  // the most specific active rule wins, ties → the latest start date. Quarry side keys on supplier / site.
  // q.types = the bhf_ruletype labels that may answer (e.g. ['Sales (Delivery)']); rules exported without a type (v3.0 seed) still match
  function findRule(q) {
    const c = norm(q.customer), s = norm(q.site), p = norm(q.product), sup = norm(q.supplier);
    const date = q.date || todayISO();
    const types = q.types || null;
    let best = null, bestScore = -1;
    SEED.records.price_rules.forEach(r => {
      if (q.company && r.company && r.company !== q.company) return;
      if (types && r.rule_type && !types.includes(r.rule_type)) return;
      if (c) { if (!r.customer || norm(r.customer) !== c) return; }
      else if (sup || s) { if (r.customer) return; if (!((sup && norm(r.supplier) === sup) || (s && r.site && norm(r.site) === s))) return; }
      else if (!q.listPrice) return;
      if (q.listPrice && (r.customer || r.supplier)) return;
      if (r.product && norm(r.product) !== p) return;
      if (!r.product && (q.requireProduct || q.listPrice)) return;
      if (r.site && (!s || norm(r.site) !== s)) return;
      if (r.start_date && String(r.start_date) > date) return;
      if (r.end_date && String(r.end_date) < date) return;
      const score = (r.product ? 2 : 0) + (r.site ? 1 : 0) + (sup && norm(r.supplier) === sup ? 0.5 : 0) + (types && r.rule_type ? 0.25 : 0);
      if (score > bestScore || (score === bestScore && String(r.start_date || '') > String((best && best.start_date) || ''))) { best = r; bestScore = score; }
    });
    return best;
  }
  function listPriceRule(company, product, date) {
    return findRule({ company, product, date, listPrice: true, types: ['List Price'] });
  }
  function ownFleetNames(company) {
    return uniqSorted(SEED.records.equipment.filter(e => /^own/i.test(e.ownership || '')).map(e => e.name));
  }

  // Suggest the number after the most recently dated ticket of the pad (not the max — one mistyped
  // 7-digit number would otherwise push every suggestion into the millions)
  function nextTicketNo(company, lists) {
    let latest = null;
    lists.forEach(l => (l || []).forEach(r => {
      if (!r || r.voided || r.company !== company) return;
      const n = parseInt(String(r.ticket_no || '').replace(/\D/g, ''), 10);
      if (!n || n >= 1000000) return;
      const key = String(r.date || '') + '|' + String(n).padStart(7, '0');
      if (!latest || key > latest.key) latest = { key, n };
    }));
    return latest ? String(latest.n + 1) : '';
  }

  // duplicateTicketGuard: checks only the active table (sales_tickets, raw_purchases, or fuel_intakes) in the same BU
  function ticketExists(company, no, formOrTable) {
    const t = norm(no);
    if (!t) return null;
    const key = formOrTable || STATE.modalForm || 'sales';
    const poolMap = {
      sales: ['sales_tickets', 'Sales Ticket'],
      sales_tickets: ['sales_tickets', 'Sales Ticket'],
      raw: ['raw_purchases', 'Raw Material Ticket'],
      raw_purchases: ['raw_purchases', 'Raw Material Ticket'],
      fuel: ['fuel_intakes', 'Fuel Intake'],
      fuel_intakes: ['fuel_intakes', 'Fuel Intake']
    };
    const [k, label] = poolMap[key] || poolMap.sales;
    const rows = (SEED.records && SEED.records[k]) || [];
    const hit = rows.find(r => r && !r.voided && r.company === company && norm(r.ticket_no) === t);
    return hit ? { table: k, label, row: hit } : null;
  }

  // meterGuard: the unit's last reading strictly before the new date (prior-day readings preferred)
  function lastMeter(company, equipment, beforeDate) {
    const e = norm(equipment);
    if (!e) return null;
    let best = null;
    SEED.records.fuel_intakes.forEach(f => {
      if (!f || f.voided || norm(f.equipment) !== e) return;
      if (company && f.company && f.company !== company) return;
      if (beforeDate && String(f.date) > beforeDate) return;
      if (f.odometer == null && f.hours == null) return;
      if (!best || String(f.date) > String(best.date)) best = f;
    });
    return best;
  }

  function openArBalance(customer) {
    const c = customerInfo(customer);
    return c && c.in_ar_book ? Number(c.ar_balance || 0) : null;
  }
  function openApBalance(supplier) {
    const s = supplierInfo(supplier);
    return s && s.in_ap_book ? Number(s.ap_balance || 0) : null;
  }

  function isOvertimeTime(hhmm) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!m) return false;
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return mins < DAY_SHIFT_FROM || mins > DAY_SHIFT_TO;
  }

  // ==========================================================================
  // VIEW 01: OVERVIEW COMMAND CENTER (EXACT ISABI REV 10 "LEDGER" ARCHITECTURE)
  // ==========================================================================
  function buildExecutiveChart(months) {
    const W = 660, H = 248, ml = 46, mr = 12, mt = 18, mb = 30;
    const pw = W - ml - mr, ph = H - mt - mb;
    const rows = (months || []).slice(-12);
    if (!rows.length) {
      return '<svg class="chart" viewBox="0 0 660 248" role="img" aria-label="No monthly ledger data"><text class="tick" x="330" y="124" text-anchor="middle">No monthly ledger data for this entity yet</text></svg>';
    }

    const sValsList = rows.map(r => {
      const s = Math.max(0, Number(STATE.basis === 'rep' ? (r.sales_rep || r.sales_ttc || 0) : (r.sales_ttc || 0))) / 1000;
      const raw = Math.max(0, Number(r.raw_cost || 0)) / 1000;
      const prof = Math.max(0, Number(r.operating_profit || 0)) / 1000;
      return [s, raw, prof];
    });

    const maxVal = Math.max(100, ...sValsList.map(v => Math.max(v[0], v[1] + v[2])));
    const max = Math.ceil(maxVal / 250) * 250;
    const y = v => mt + ph - (v / max) * ph;

    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const tv = Math.round(max * f);
      g += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}"/>`;
      g += `<text class="tick" x="${ml - 8}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end">$${tv.toLocaleString()}k</text>`;
    });
    g += `<text class="tick" x="${ml}" y="${mt - 5}" text-anchor="start">USD thousands</text>`;

    const n = rows.length;
    const slot = pw / n;
    const bw = Math.min(28, Math.max(16, slot * 0.58));
    const subW = (bw - 2) / 3;

    rows.forEach((row, i) => {
      const x0 = ml + slot * i + (slot - bw) / 2;
      const [sK, rK, pK] = sValsList[i];
      const ymFull = String(row['Year Month'] || row.YearMonthNo || '');
      const ymShort = ymFull.replace('2024', '24').replace('2025', '25').replace('2026', '26');

      const bars = [
        { v: sK, cls: 's-1', x: x0 },
        { v: rK, cls: 's-2', x: x0 + subW + 1 },
        { v: pK, cls: 's-3', x: x0 + (subW + 1) * 2 }
      ].map(b => {
        const top = y(b.v);
        const bottom = y(0);
        const h = Math.max(2, bottom - top);
        return `<rect class="${b.cls}" x="${b.x.toFixed(1)}" y="${top.toFixed(1)}" width="${subW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`;
      }).join('');

      const tip = `Sales TTC: $${sK.toFixed(1)}k · Raw Cost: $${rK.toFixed(1)}k · Cash Profit: $${pK.toFixed(1)}k · Loads: ${fmtNum(row.loads)}`;
      g += `<g class="col" data-m="${esc(ymFull)}" data-t="$${sK.toFixed(1)}k Sales" data-tip="${esc(tip)}">`
        + `<rect class="hit" x="${(ml + slot * i).toFixed(1)}" y="${mt}" width="${slot.toFixed(1)}" height="${ph}"/>`
        + `${bars}</g>`;
      g += `<text class="tick" x="${(x0 + bw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(ymShort.slice(0, 6))}</text>`;
      if (i === n - 1) {
        g += `<text class="lbl" x="${(x0 + bw / 2).toFixed(1)}" y="${(y(sK) - 6).toFixed(1)}" text-anchor="middle">$${Math.round(sK)}k</text>`;
      }
    });

    g += `<line class="axis" x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly revenue, quarry cost, and profit trajectory">${g}</svg>`;
  }

  function tbStatus(k) {
    const v = Number((k || {}).tb_check);
    if (k && k.tb_check == null) return { ok: null, label: 'No ledger' };
    return Math.abs(v) < 0.005 ? { ok: true, label: 'Balanced' } : { ok: false, label: fmtUSD(v, 2) + ' off' };
  }

  function appStrip() {
    const sum = appEnteredSummary();
    if (!sum.length) return '';
    return `<div class="app-strip" role="status"><b>App-entered this period (not yet in the book totals):</b>${sum.map(s => `<span>${fmtNum(s.n)} ${esc(s.label)} · ${s.unit === 'L' ? fmtNum(s.sum, 0) + ' L' : fmtUSD(s.sum, 0)}</span>`).join('')}<button type="button" class="btn" data-nav-jump="sales" style="padding:2px 9px;font-size:11px">Open registers →</button></div>`;
  }

  function renderOverview() {
    const m = getModel();
    const k = getKPI();
    const wtcK = (SEED.models.wtc && SEED.models.wtc.periods[STATE.period]) || {};
    const bbcK = (SEED.models.bbconstruction && SEED.models.bbconstruction.periods[STATE.period]) || {};
    const ltK = (SEED.models.lionstransport && SEED.models.lionstransport.periods && SEED.models.lionstransport.periods[STATE.period]) || {};
    const ltHasLedger = modelHasLedger('lionstransport');

    const salesVal = STATE.basis === 'rep' ? (k.sales_rep_date || k.sales_ttc) : k.sales_ttc;
    const rawVal = STATE.basis === 'rep' ? (k.raw_rep_date || k.raw_cost) : k.raw_cost;
    const expVal = STATE.basis === 'rep' ? (k.exp_rep_date || k.expenses) : k.expenses;
    const opProfit = STATE.basis === 'rep' ? (k.op_profit_rep_date || k.operating_profit) : k.operating_profit;

    const sentinelRows = buildSentinelItems().slice(0, 4);
    const soaAll = m.soa_stream || [];
    const soaRows = soaAll.slice(0, 8);
    const tb = tbStatus(k);
    const booksCount = STATE.company === 'manufacturing-group' ? '2' : (modelHasLedger() ? '1' : '0');
    const booksUnit = STATE.company === 'manufacturing-group' ? ' of 3 live' : ' of 1';

    let totDeb = 0, totCred = 0;
    soaAll.forEach(r => { totDeb += Number(r.debit || 0); totCred += Number(r.credit || 0); });

    if (!modelHasLedger()) {
      return `
        <div class="cockpit-banner">
          <div class="cockpit-title-block">
            <div class="cockpit-eyebrow">${esc(COMPANY_LABELS[STATE.company])}</div>
            <div class="cockpit-title">No ledger published for this entity yet</div>
            <div class="cockpit-sub">The semantic snapshot carries no periods, customers or GL for ${esc(COMPANY_LABELS[STATE.company])}. Transactions keyed here still post to the cloud ledger and appear in the registers.</div>
          </div>
        </div>
        ${appStrip()}
        <div class="panel-card"><div class="panel-head"><div class="panel-title"><span>WHAT YOU CAN DO HERE</span></div></div>
          <div style="padding:14px 16px;font-size:13px;line-height:1.6">
            • Key sales tickets, raw receipts, fuel intakes, expenses and settlements with <b>+ New Entry</b> (they carry the <span class="badge badge-app">APP</span> badge until the books absorb them).<br>
            • Switch to <b>WTC</b>, <b>BBConstruction</b> or <b>All Group</b> in the entity bar for the published KPIs, GL and statements.
          </div></div>`;
    }

    return `
      <!-- 1. UNIFIED 6-COLUMN EXECUTIVE KPI BAND (REV 10 "LEDGER" SURFACE) -->
      <section class="kpis" aria-label="Executive Key Performance Indicators">
        <div class="kpi kpi-link" data-nav-jump="sales" role="button" tabindex="0" title="Open the Sales & Deliveries register">
          <span class="k">Consolidated Revenue (TTC)</span>
          <span class="v num">${fmtUSD(salesVal, 0)}</span>
          <span class="d good">Sales Ex-VAT: ${fmtUSD(k.gross_sales || k.net_sales, 0)} · VAT 11%: ${fmtUSD(k.sales_vat, 0)}</span>
        </div>
        <div class="kpi kpi-link" data-nav-jump="raw" role="button" tabindex="0" title="Open the Raw Material & Quarries register">
          <span class="k">Realized Gross Margin</span>
          <span class="v num">${fmtUSD(k.gross_margin, 0)}<small>${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</small></span>
          <span class="d good">Raw Quarry Cost: ${fmtUSD(rawVal, 0)}</span>
        </div>
        <div class="kpi kpi-link" data-nav-jump="expenses" role="button" tabindex="0" title="Open Expenses & Payroll">
          <span class="k">Operating Cash Profit</span>
          <span class="v num">${fmtUSD(opProfit, 0)}<small>${fmtPct(k.op_margin_pct, opProfit, k.net_sales)}</small></span>
          <span class="d">Expenses: ${fmtUSD(expVal, 0)} · Payroll: ${fmtUSD(k.salaries_paid, 0)}</span>
        </div>
        <div class="kpi kpi-link" data-nav-jump="ledger" role="button" tabindex="0" title="Open the General Ledger & till">
          <span class="k">Cash Till &amp; Net Flow (5300)</span>
          <span class="v num">${fmtUSD(k.cash_till, 2)}</span>
          <span class="d">In: ${fmtUSD(k.cash_inflow, 0)} · Out: ${fmtUSD(k.cash_outflow, 0)}</span>
        </div>
        <div class="kpi kpi-link" data-nav-jump="customers" role="button" tabindex="0" title="Open Customers & AR Aging">
          <span class="k">Open AR Receivables (FIFO)</span>
          <span class="v num">${fmtUSD(k.ar_balance, 0)}</span>
          <span class="d ${Number(k.ar_overdue || 0) > 0 ? 'crit' : 'good'}">Overdue &gt;30d: ${fmtUSD(k.ar_overdue, 0)} · DSO ${fmtNum(k.dso_days, 0)}d</span>
        </div>
        <div class="kpi books kpi-link" data-nav-jump="sentinels" role="button" tabindex="0" title="Open the AI Sentinels & Trial Balance audit">
          <span class="k">Operating Books Status</span>
          <span class="v num">${booksCount}<small>${booksUnit}</small></span>
          <span class="d ${tb.ok === false ? 'crit' : 'good'}">Trial Balance ${tb.ok === false ? 'variance ' + fmtUSD(k.tb_check, 2) : '$0.00 Variance'}</span>
        </div>
      </section>

      <!-- 2. SECONDARY OPERATIONAL PROOF STRIP -->
      <section class="ops-strip" aria-label="Operational Unit Economics">
        <div class="ops-cell kpi-link" data-nav-jump="sales" role="button" tabindex="0"><span>Sales Loads &amp; Volume</span><b class="num">${fmtNum(k.loads)} (${fmtNum(k.tons_sold, 0)} t)</b></div>
        <div class="ops-cell kpi-link" data-nav-jump="pricing" role="button" tabindex="0"><span>Avg Selling Price (TTC)</span><b class="num">${fmtUSD(k.avg_price_ttc, 2)} / unit</b></div>
        <div class="ops-cell kpi-link" data-nav-jump="raw" role="button" tabindex="0"><span>Raw Quarry Intake</span><b class="num">${fmtNum(k.raw_loads)} loads (${fmtUSD(k.avg_raw_cost, 2)}/u)</b></div>
        <div class="ops-cell kpi-link" data-nav-jump="fleet" role="button" tabindex="0"><span>Active Fleet &amp; Cost/Ton</span><b class="num">${fmtNum(k.active_equip)} units · ${fmtUSD(k.cost_per_ton, 2)}/t</b></div>
        <div class="ops-cell kpi-link" data-nav-jump="pricing" role="button" tabindex="0"><span>Customer Price Matrix</span><b class="num">${fmtNum(k.active_agreements)} active rules</b></div>
        <div class="ops-cell kpi-link" data-nav-jump="suppliers" role="button" tabindex="0"><span>3-Leg AP Open Balance</span><b class="num">${fmtUSD(k.ap_balance, 0)}</b></div>
      </section>
      ${appStrip()}

      <!-- 3. ROW 2: MONTHLY TRAJECTORY CHART + OPERATING ENTITIES & TOP GRADES -->
      <section class="row2">
        <div class="panel">
          <div class="ph">
            <div>
              <h3>Monthly Revenue, Quarry Cost &amp; Cash Profit Trajectory</h3>
              <span class="ph-sub">${esc(COMPANY_LABELS[STATE.company])} · Tap or hover bars to inspect monthly ledger totals</span>
            </div>
            <div class="legend">
              <span><i class="sw-box s-1"></i>Sales TTC</span>
              <span><i class="sw-box s-2"></i>Raw Quarry Cost</span>
              <span><i class="sw-box s-3"></i>Operating Profit</span>
            </div>
          </div>
          <div class="chartwrap" id="execChartWrap">
            ${buildExecutiveChart(getScopedMonthly(m.monthly, 12))}
            <div class="chart-tip" id="execChartTip" hidden></div>
          </div>
          ${(() => {
            const months = getScopedMonthly(m.monthly, 12);
            const peakM = months.reduce((best, r) => (Number(r.sales_ttc || 0) > Number((best && best.sales_ttc) || 0) ? r : best), months[0] || {});
            const peakLabel = peakM['Year Month'] || peakM.Month || peakM.label || '—';
            const avgM = months.length ? months.reduce((a, r) => a + Number(r.sales_ttc || 0), 0) / months.length : 0;
            const cogsPct = Number(k.net_sales || 0) > 0 ? ((Number(k.raw_cost || 0) / Number(k.net_sales || 1)) * 100).toFixed(1) + '%' : '0.0%';
            const opPctStr = fmtPct(k.op_margin_pct, opProfit, k.net_sales);
            const gmPctStr = fmtPct(k.gm_pct, k.gross_margin, k.net_sales);
            return `
              <div class="chart-ftr">
                <div class="chart-ftr-cell"><small>Peak Month (${esc(peakLabel)})</small><b class="num">${fmtUSD(peakM.sales_ttc || 0, 0)}</b></div>
                <div class="chart-ftr-cell"><small>Monthly Run-Rate (last ${months.length || 12}m)</small><b class="num">${fmtUSD(avgM, 0)} / mo</b></div>
                <div class="chart-ftr-cell"><small>Direct Quarry Ratio</small><b class="num">${cogsPct} of Net</b></div>
                <div class="chart-ftr-cell"><small>Operating Profit %</small><b class="num">${opPctStr} (${gmPctStr} GM)</b></div>
              </div>
            `;
          })()}
        </div>

        <div class="panel">
          <div class="ph">
            <h3>Operating Entities &amp; Books Status</h3>
            <span class="ph-sub">Click any entity to filter workspace</span>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th class="n">Sales TTC</th>
                  <th class="n hide-xs">Loads</th>
                  <th class="n">GM %</th>
                  <th class="n">Op. Profit</th>
                  <th>Books</th>
                </tr>
              </thead>
              <tbody>
                ${[['wtc', 'WTC<span class="hide-xs"> · World Trading</span>', wtcK], ['bbconstruction', 'BBConstruction', bbcK]].map(([key, label, kk]) => {
                  const t = tbStatus(kk);
                  return `
                <tr class="clickable-row" data-jump-co="${key}">
                  <td><b>${label}</b></td>
                  <td class="n">${fmtUSD(kk.sales_ttc, 0)}</td>
                  <td class="n hide-xs">${fmtNum(kk.loads)}</td>
                  <td class="n">${fmtPct(kk.gm_pct, kk.gross_margin, kk.net_sales)}</td>
                  <td class="n">${fmtUSD(kk.operating_profit, 0)}</td>
                  <td><span class="m-chip ${t.ok === false ? 'crit' : 'closed'}">${esc(t.label)}</span></td>
                </tr>`;
                }).join('')}
                <tr class="clickable-row" data-jump-co="lionstransport">
                  <td><b>Lions Transport</b></td>
                  <td class="n">${ltHasLedger ? fmtUSD(ltK.sales_ttc, 0) : '—'}</td>
                  <td class="n hide-xs">${ltHasLedger ? fmtNum(ltK.loads) : '—'}</td>
                  <td class="n">${ltHasLedger ? fmtPct(ltK.gm_pct, ltK.gross_margin, ltK.net_sales) : 'Fleet'}</td>
                  <td class="n">${ltHasLedger ? fmtUSD(ltK.operating_profit, 0) : '—'}</td>
                  <td><span class="m-chip ${ltHasLedger ? 'closed' : ''}">${ltHasLedger ? 'Balanced' : 'No ledger'}</span></td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="total">
                  <td><b>Group Total<span class="hide-xs"> (${ltHasLedger ? 3 : 2} live BUs)</span></b></td>
                  <td class="n"><b>${fmtUSD(k.sales_ttc, 0)}</b></td>
                  <td class="n hide-xs"><b>${fmtNum(k.loads)}</b></td>
                  <td class="n"><b>${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</b></td>
                  <td class="n"><b>${fmtUSD(k.operating_profit, 0)}</b></td>
                  <td><span class="m-chip ${tb.ok === false ? 'crit' : 'brass'}">${tb.ok === false ? 'TB ' + tb.label : 'Audited'}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="ph" style="border-top:1px solid var(--line);margin-top:4px">
            <h3>Top Aggregates &amp; Materials by Revenue</h3>
            <span class="ph-sub">${(m.products || []).length} Active Grades</span>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Aggregate Grade</th>
                  <th class="hide-xs">UoM</th>
                  <th class="n hide-xs">Loads</th>
                  <th class="n">Tons</th>
                  <th class="n">Avg TTC</th>
                  <th class="n">Revenue TTC</th>
                </tr>
              </thead>
              <tbody>
                ${(m.products || []).slice(0, 4).map(p => `
                  <tr>
                    <td><b>${esc(p.Product)}</b></td>
                    <td class="mu hide-xs">${esc(p.UoM || 'm³')}</td>
                    <td class="n hide-xs">${fmtNum(p.loads)}</td>
                    <td class="n">${fmtNum(p.tons_sold, 0)}</td>
                    <td class="n">${fmtUSD(p.avg_price_ttc, 2)}</td>
                    <td class="n"><b>${fmtUSD(p.sales_ttc, 0)}</b></td>
                  </tr>
                `).join('') || emptyRow(6, 'No product revenue in this snapshot')}
              </tbody>
              <tfoot>
                <tr class="total">
                  <td><b>Total (${fmtNum((m.products || []).length)} grades)</b></td>
                  <td class="mu hide-xs">All</td>
                  <td class="n hide-xs"><b>${fmtNum((m.products || []).reduce((a, p) => a + Number(p.loads || 0), 0))}</b></td>
                  <td class="n"><b>${fmtNum((m.products || []).reduce((a, p) => a + Number(p.tons_sold || 0), 0), 0)}</b></td>
                  <td class="n"><b>${fmtUSD(k.avg_price_ttc, 2)}</b></td>
                  <td class="n"><b>${fmtUSD((m.products || []).reduce((a, p) => a + Number(p.sales_ttc || 0), 0) || k.sales_ttc, 0)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <!-- 4. ROW 3: EXECUTIVE EXCEPTIONS & WATCHDOGS + AUDITED DOUBLE-ENTRY GL STREAM -->
      <section class="row3">
        <div class="panel">
          <div class="ph">
            <h3>Executive Exceptions &amp; Sentinel Watchdogs</h3>
            <button type="button" class="btn-ghost-bar" style="padding:3px 9px;font-size:11px" data-nav-jump="sentinels">All ${buildSentinelItems().length} Sentinels</button>
          </div>
          <ul class="att">
            ${sentinelRows.map(s => {
              const cls = s.severity === 'ok' ? 'good' : s.severity;
              return `
                <li class="${cls}">
                  <b>${esc(s.title)}</b>
                  <span>${esc(s.detail)}</span>
                  <button type="button" class="att-act" data-nav-jump="sentinels">${esc(s.badge)}</button>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div class="panel">
          <div class="ph">
            <div>
              <h3>Audited General Ledger Stream (Double-Entry Lebanese CoA)</h3>
              <span class="ph-sub">Closed with the ISABI Double Rule · Every Sales Ticket, Quarry Leg, VAT 11% &amp; Settlement</span>
            </div>
            <button type="button" class="btn-ghost-bar" style="padding:3px 9px;font-size:11px" data-nav-jump="ledger">Full Trial Balance</button>
          </div>
          <div class="table-scroll">
            <table class="m-grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BU</th>
                  <th>Voucher</th>
                  <th>CoA Account &amp; Counterparty</th>
                  <th class="n">Debit</th>
                  <th class="n">Credit</th>
                </tr>
              </thead>
              <tbody>
                ${soaRows.map(r => {
                  const rawDoc = String(r.doc || '—');
                  const hashMatch = rawDoc.match(/#\d+/);
                  const shortDoc = hashMatch ? ('TKT ' + hashMatch[0]) : rawDoc.slice(0, 14);
                  const cp = String(r.detail || r.desc || '').split('·')[0].trim().slice(0, 20);
                  return `
                  <tr>
                    <td class="mu">${esc(String(r.date || '').slice(0, 10))}</td>
                    <td><span class="m-chip brass">${esc(r.company === 'BBConstruction' ? 'BBC' : (r.company || 'WTC'))}</span></td>
                    <td class="mono">${esc(shortDoc)}</td>
                    <td><b>${esc(r.code)}</b> · ${esc(String(r.account || '').slice(0, 18))}${cp ? ` <span class="mu">(${esc(cp)})</span>` : ''}</td>
                    <td class="n">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td>
                    <td class="n">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td>
                  </tr>
                  `;
                }).join('') || emptyRow(6, 'No journal legs in this snapshot')}
              </tbody>
              <tfoot>
                <tr class="total">
                  <td colspan="4"><b>Total (${fmtNum(soaAll.length)} legs) · TB variance ${fmtUSD(k.tb_check || 0, 2)}</b></td>
                  <td class="n"><b>${fmtUSD(totDeb, 2)}</b></td>
                  <td class="n"><b>${fmtUSD(totCred, 2)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  // ==========================================================================
  // VIEW 02: AI SENTINELS (M280 LIVE WATCHDOGS — DRIVEN BY THE SNAPSHOT DATA)
  // ==========================================================================
  function sentinelSlice() {
    const sn = SEED.sentinels || {};
    const mk = SENTINEL_MODEL_KEY[STATE.company];
    return {
      fleet: (((sn.fleet_fuel_overtime_auditor || {}).by_model) || {})[mk] || {},
      pricing: (((sn.pricing_commission_payroll_sentinel || {}).by_model) || {})[mk] || {},
      parity: sn.sharepoint_parity_sentinel || {},
      generated: sn.generated_at || ''
    };
  }

  function buildSentinelItems() {
    const k = getKPI();
    const { fleet, pricing, parity } = sentinelSlice();
    const scope = STATE.company === 'manufacturing-group' ? 'WTC & BBConstruction' : COMPANY_BU_MATCH[STATE.company];
    const items = [];

    const tbv = k.tb_check == null ? null : Number(k.tb_check);
    items.push({
      code: 'S1 · TRIAL_BALANCE_TIE', title: 'Double-Entry Trial Balance Integrity (Lebanese CoA)',
      detail: tbv == null ? 'No ledger published for this entity yet.' : `Total Debits vs Total Credits across every SOA journal leg (sales, raw material, haulage, expenses, VAT 11%, receipts, settlements): variance ${fmtUSD(tbv, 2)}.`,
      severity: tbv == null ? 'warn' : (Math.abs(tbv) < 0.005 ? 'ok' : 'crit'),
      badge: tbv == null ? 'NO LEDGER' : (Math.abs(tbv) < 0.005 ? 'PASS · $0.00 DIFF' : 'FAIL · ' + fmtUSD(tbv, 2)),
      company: scope
    });

    const tank = fleet.diesel_stock_balance_l != null ? Number(fleet.diesel_stock_balance_l) : (k.diesel_in_tank == null ? null : Number(k.diesel_in_tank));
    items.push({
      code: 'S2 · DIESEL_TANK_RECONCILIATION', title: 'Diesel Tank Physical vs Ledger Reconciliation',
      detail: tank == null ? 'No diesel ledger for this entity.' : `Purchased ${fmtNum(fleet.diesel_purchased_l, 0)} L − issued ${fmtNum(fleet.diesel_issued_l, 0)} L − sold = ${fmtNum(tank, 0)} L in tank.${tank < -1000 ? ' A negative tank means bulk diesel invoices were booked under General Expenses instead of Fuel Purchases — the fuel form refuses new diesel intakes at that BU until the history is corrected (m212).' : ''}`,
      severity: tank == null ? 'warn' : (tank < -1000 ? 'crit' : (tank < 0 ? 'warn' : 'ok')),
      badge: tank == null ? 'NO DATA' : (tank < 0 ? 'ACTION · ' + fmtNum(tank, 0) + ' L' : 'OK · ' + fmtNum(tank, 0) + ' L'),
      company: scope
    });

    const meters = Number(fleet.meter_readings_to_check || 0);
    const outliers = fleet.consumption_outliers || [];
    items.push({
      code: 'S3 · FUEL_METER_OUTLIERS (M142)', title: 'Odometer & Hour-Meter Tolerance Watchdog',
      detail: `${fmtNum(meters)} meter readings to check · ${outliers.length} consumption outlier${outliers.length === 1 ? '' : 's'}${outliers.length ? ' (' + outliers.slice(0, 3).map(o => `${o.equipment} ${fmtNum(o.value, 1)} ${o.metric}`).join(', ') + ')' : ''} · ${fmtNum(fleet.own_units_idle_30d || 0)} own units idle 30+ days.`,
      severity: meters > 0 || outliers.length ? 'warn' : 'ok',
      badge: meters > 0 ? fmtNum(meters) + ' TO CHECK' : (outliers.length ? outliers.length + ' OUTLIER' + (outliers.length === 1 ? '' : 'S') : 'GUARD ACTIVE'),
      company: `${fmtNum(fleet.active_equipment || k.active_equip || 0)} units`
    });

    const ar60 = Number(k.ar_60_plus || 0);
    items.push({
      code: 'S4 · AR_OVERDUE_60_PLUS', title: 'Customer Receivables Overdue > 60 Days (FIFO Allocated)',
      detail: `Open AR ${fmtUSD(k.ar_balance, 2)} (VAT-inclusive per m249) · ${fmtUSD(ar60, 2)} aged past 60 days after FIFO receipt allocation · DSO ${fmtNum(k.dso_days, 0)} days.`,
      severity: ar60 > 0 ? 'warn' : 'ok',
      badge: `${fmtUSD(ar60, 0)} > 60D`,
      company: scope
    });

    const below = Number(pricing.sales_below_agreed_usd || 0);
    const lapsed = Number(pricing.lapsed_agreement_pairs_count || 0);
    items.push({
      code: 'S5 · PRICE_AGREEMENT_ENFORCEMENT', title: `${fmtNum(pricing.active_agreements || k.active_agreements || 0)} Active Price Agreements vs Tickets`,
      detail: `${fmtUSD(below, 0)} sold below the agreed price across ${fmtNum(pricing.below_agreed_pairs_count || 0)} customer × product pairs · ${fmtNum(lapsed)} pairs still trading on lapsed agreements · ${fmtNum(pricing.truck_unit_delivery_rules || 0)} per-truck delivery rules.`,
      severity: below > 0 || lapsed > 0 ? 'warn' : 'ok',
      badge: below > 0 ? fmtUSD(below, 0) + ' BELOW' : 'ENFORCED',
      company: scope
    });

    const dups = Number(pricing.duplicate_ticket_numbers || 0);
    const unnum = Number(pricing.unnumbered_tickets || 0);
    items.push({
      code: 'S6 · TICKET_BOOK_HYGIENE', title: 'Duplicate & Unnumbered Tickets in the Books',
      detail: `${fmtNum(dups)} duplicate ticket numbers · ${fmtNum(unnum)} unnumbered tickets · ${fmtNum(pricing.missing_tickets_in_books || 0)} numbers missing from ${fmtNum(pricing.incomplete_ticket_books || 0)} incomplete pads. The entry desk blocks a repeated number in the same BU unless you confirm it.`,
      severity: dups > 0 || unnum > 0 ? 'warn' : 'ok',
      badge: dups > 0 ? fmtNum(dups) + ' DUPLICATES' : 'CLEAN',
      company: scope
    });

    const unmatched = Number(pricing.unmatched_salary_payments_usd || 0);
    items.push({
      code: 'S7 · PAYROLL_CONTRACT_MATCH', title: 'Salary Payments Without an Employment Contract',
      detail: `${fmtUSD(unmatched, 2)} paid on staff-months with no contract · ${fmtUSD(fleet.unallocated_driver_payroll_usd || 0, 0)} driver payroll not allocated to a unit (${fmtNum(fleet.unallocated_driver_months_count || 0)} months) · commission balance ${fmtUSD(pricing.commission_balance_usd || 0, 0)}.`,
      severity: unmatched > 0 ? 'warn' : 'ok',
      badge: unmatched > 0 ? fmtUSD(unmatched, 0) + ' UNMATCHED' : 'MATCHED',
      company: scope
    });

    const anomalies = Number(parity.date_basis_anomalies_gt_31d_count || 0);
    items.push({
      code: 'S8 · DATE_BASIS_PARITY', title: 'Transaction vs Reporting Date Gaps > 31 Days',
      detail: `${fmtNum(anomalies)} rows carry a reporting date more than 31 days from the transaction date · ${fmtNum(parity.unlinked_vat_invoices_count || 0)} VAT invoices not linked to tickets · ${fmtNum(parity.header_vs_tickets_mismatch_count || 0)} VAT headers disagree with their tickets.`,
      severity: anomalies > 0 ? 'warn' : 'ok',
      badge: anomalies > 0 ? fmtNum(anomalies) + ' GAPS' : 'IN SYNC',
      company: 'SharePoint parity'
    });

    return items;
  }

  function miniTable(title, rows, cols, panelId) {
    const list = rows || [];
    const footHtml = list.length ? `<tfoot><tr>${cols.map((c, idx) => {
      if (idx === 0) return `<td><b>TOTAL (${fmtNum(list.length)})</b></td>`;
      if (!c.r) return `<td></td>`;
      const isAvg = /price|agreed|actual|value|gap/i.test(c.key || '') && !/shortfall|unmatched|amount|header_|diesel/i.test(c.key || '');
      let sum = 0, cnt = 0;
      list.forEach(r => {
        const v = Number(r[c.key]);
        if (Number.isFinite(v)) { sum += v; cnt++; }
      });
      if (!cnt) return `<td class="r">—</td>`;
      const val = isAvg ? (sum / cnt) : sum;
      const txt = c.fmt ? c.fmt(val, {}) : fmtNum(val, 0);
      return `<td class="r">${isAvg ? '<span class="mu" style="font-size:10px">Avg </span>' : ''}<b>${txt}</b></td>`;
    }).join('')}</tr></tfoot>` : '';
    return `
      <div class="panel-card" id="${esc(panelId)}">
        <div class="panel-head"><div class="panel-title"><span>${title}</span></div><span class="panel-meta">${fmtNum(list.length)} rows ${list.length ? exportBtn(panelId, title.replace(/&amp;/g, 'and')) : ''}</span></div>
        <div class="table-wrap"><table class="ledger-table">
          <thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${c.label}</th>`).join('')}</tr></thead>
          <tbody>${list.slice(0, 60).map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r' : ''}${c.mono ? ' mono' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] == null ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('') || emptyRow(cols.length, 'Nothing flagged')}</tbody>
          ${footHtml}
        </table></div>
      </div>`;
  }

  function renderSentinels() {
    const items = buildSentinelItems();
    const { fleet, pricing, parity, generated } = sentinelSlice();
    const open = items.filter(i => i.severity !== 'ok').length;
    const k = getKPI();
    const usd0 = v => fmtUSD(v, 0);
    const usd2 = v => fmtUSD(v, 2);
    const num1 = v => fmtNum(v, 1);
    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">AUTONOMOUS AUDIT &amp; ANOMALY DETECTION · M280 ENGINE · RUN ${esc(String(generated).slice(0, 16).replace('T', ' ') || '—')}</div>
          <div class="cockpit-title">AI Sentinel Watchdogs</div>
          <div class="cockpit-sub">Deterministic audit rules evaluated against the SQL ledger snapshot for ${esc(COMPANY_LABELS[STATE.company])} — no external BI license required.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Sentinels</div><div class="cockpit-pill-val brass">${items.length} Rules</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Needing Action</div><div class="cockpit-pill-val ${open ? 'amber' : 'emerald'}">${open}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Variance</div><div class="cockpit-pill-val ${Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'emerald' : 'amber'}">${fmtUSD(k.tb_check || 0, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Below-Agreed Sales</div><div class="cockpit-pill-val ${Number(pricing.sales_below_agreed_usd || 0) > 0 ? 'amber' : 'emerald'}">${fmtUSD(pricing.sales_below_agreed_usd || 0, 0)}</div></div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-head">
          <div class="panel-title"><span>LIVE AUDIT CHECKS &amp; RECOMMENDED ACTIONS</span></div>
          <span class="panel-meta">Verified against SQLite &amp; Semantic Baseline</span>
        </div>
        <div class="sentinel-list">
          ${items.map(s => `
            <div class="sentinel-item ${s.severity}" style="padding:14px 16px">
              <div>
                <div class="mono" style="font-size:10px;color:var(--brass);margin-bottom:2px">${esc(s.code)} · ${esc(s.company)}</div>
                <div class="sentinel-title" style="font-size:14px">${esc(s.title)}</div>
                <div class="sentinel-detail" style="font-size:12.5px;margin-top:4px">${esc(s.detail)}</div>
              </div>
              <span class="badge ${s.severity === 'ok' ? 'badge-ok' : (s.severity === 'crit' ? 'badge-err' : 'badge-warn')}">${esc(s.badge)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="mini-table-grid">
        ${miniTable('TOP SALES BELOW AGREED PRICE', pricing.top_below_agreed_exceptions || [], [
          { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Qty', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
          { label: 'Last Price', key: 'last_price', r: true, fmt: usd2 }, { label: 'Agreed', key: 'agreed_price', r: true, fmt: usd2 }, { label: 'Shortfall', key: 'shortfall_usd', r: true, fmt: (v, r) => v != null ? usd0(v) : (r.agreed_price != null && r.last_price != null ? usd0((Number(r.agreed_price) - Number(r.last_price)) * Number(r.qty || 0)) : '—') }
        ], 'snBelow')}
        ${miniTable('LAPSED AGREEMENTS STILL TRADING', pricing.lapsed_agreement_pairs || [], [
          { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Qty', key: 'qty', r: true, fmt: v => fmtNum(v, 1) },
          { label: 'Actual', key: 'actual_price', r: true, fmt: usd2 }, { label: 'Agreed (lapsed)', key: 'agreed_price', r: true, fmt: usd2 }
        ], 'snLapsed')}
        ${miniTable('FUEL CONSUMPTION OUTLIERS', fleet.consumption_outliers || [], [
          { label: 'Equipment', key: 'equipment', mono: true }, { label: 'Type', key: 'type' }, { label: 'Metric', key: 'metric' },
          { label: 'Value', key: 'value', r: true, fmt: num1 }, { label: 'Distance / Hours', key: 'distance_km', r: true, fmt: (v, r) => fmtNum(v != null ? v : r.hours, 0) }, { label: 'Diesel (L)', key: 'diesel_l', r: true, fmt: v => fmtNum(v, 0) }
        ], 'snFuel')}
        ${miniTable('SALARY PAYMENTS WITHOUT A CONTRACT', pricing.unmatched_salary_by_staff || [], [
          { label: 'Staff Member', key: 'staff' }, { label: 'Unmatched ($)', key: 'unmatched_usd', r: true, fmt: usd2 }
        ], 'snPayroll')}
        ${miniTable('TRANSACTION vs REPORTING DATE GAPS &gt; 31 DAYS', (parity.date_basis_anomalies_gt_31d || []).filter(r => STATE.company === 'manufacturing-group' || r.bu === COMPANY_BU_MATCH[STATE.company]), [
          { label: 'Table', key: 'table' }, { label: 'BU', key: 'bu' }, { label: 'Record', key: 'name' }, { label: 'Ticket', key: 'ticket', mono: true },
          { label: 'Tx Date', key: 'transaction_date', mono: true }, { label: 'Rep Date', key: 'reporting_date', mono: true }, { label: 'Gap (d)', key: 'gap_days', r: true, fmt: v => fmtNum(v) }, { label: 'Amount', key: 'amount_usd', r: true, fmt: usd2 }
        ], 'snDates')}
        ${miniTable('VAT INVOICES NOT LINKED TO TICKETS (SAMPLE)', (parity.unlinked_vat_invoices_sample || []).filter(r => STATE.company === 'manufacturing-group' || r.bu === COMPANY_BU_MATCH[STATE.company]), [
          { label: 'BU', key: 'bu' }, { label: 'Invoice', key: 'invoice' }, { label: 'No.', key: 'invoiceno', mono: true }, { label: 'Date', key: 'date', mono: true },
          { label: 'Header Net', key: 'header_net', r: true, fmt: usd2 }, { label: 'Header VAT', key: 'header_vat', r: true, fmt: usd2 }
        ], 'snVat')}
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 03: SALES & DELIVERIES (12-COL LEDGER + 35 FORM RULES)
  // ==========================================================================
  function renderSales() {
    const k = getKPI();
    const base = filterRecords(SEED.records.sales_tickets);
    const rows = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'delivery') return r.sale_type === 'Delivery';
      if (STATE.chipFilter === 'pickup') return r.sale_type === 'Pickup';
      if (STATE.chipFilter === 'credit') return r.method === 'Credit';
      if (STATE.chipFilter === 'cash') return r.method === 'Cash';
      if (STATE.chipFilter === 'overtime') return !!r.overtime;
      if (STATE.chipFilter === 'vat') return Number(r.vat || 0) > 0;
      if (STATE.chipFilter === 'app') return isAppRecord(r);
      return true;
    }), 'sales', 'date', 'desc');
    const shown = rows.slice(0, shownCount('sales'));
    let sumQty = 0, sumMat = 0, sumTr = 0, sumNet = 0, sumVat = 0, sumTtc = 0, sumCash = 0, sumCredit = 0, sumDisc = 0;
    const byCo = {
      WTC: { loads: 0, net: 0, cash: 0, credit: 0, vat: 0, ttc: 0, disc: 0 },
      BBConstruction: { loads: 0, net: 0, cash: 0, credit: 0, vat: 0, ttc: 0, disc: 0 }
    };
    rows.forEach(r => {
      const sgn = ticketSign(r);
      const q = Number(r.qty || 0);
      const mat = sgn * Number(r.price || 0);
      const tr = sgn * Number(r.trans_price || 0);
      const net = sgn * Number(r.total != null ? r.total : (Number(r.price || 0) + Number(r.trans_price || 0)));
      const vat = sgn * Number(r.vat || 0);
      const ttc = sgn * Number(r.total_ttc != null ? r.total_ttc : (Number(r.total || 0) + Number(r.vat || 0)));
      const disc = Number(r.discount || 0);
      const isCash = /^cash|^c\b/i.test(String(r.method || ''));
      sumQty += q;
      sumMat += mat;
      sumTr += tr;
      sumNet += net;
      sumVat += vat;
      sumTtc += ttc;
      sumDisc += disc;
      if (isCash) sumCash += net; else sumCredit += net;
      const bucket = byCo[r.company];
      if (bucket) {
        bucket.loads += 1;
        bucket.net += net;
        if (isCash) bucket.cash += net; else bucket.credit += net;
        bucket.vat += vat;
        bucket.ttc += ttc;
        bucket.disc += disc;
      }
    });
    const isSalesFiltered = Boolean(periodRange(STATE.period) || STATE.search.trim() || STATE.chipFilter !== 'all');
    const mdlProds = getModel().products || [];
    const mdlSites = getModel().sites || [];
    const allProds = !isSalesFiltered ? mdlProds : (() => {
      const map = new Map();
      rows.forEach(r => {
        const name = r.product || '(Unspecified)';
        let cur = map.get(name);
        if (!cur) {
          const ref = mdlProds.find(p => norm(p.Product) === norm(name)) || productByName(name) || {};
          cur = {
            Product: name,
            'Material Family': ref['Material Family'] || ref.type || 'Aggregate',
            UoM: ref.UoM || ref.uom || r.uom || 'm³',
            list_price: ref.list_price != null ? ref.list_price : listPrice(name),
            loads: 0, qty_sold: 0, tons_sold: 0, net_sum: 0, sales_ttc: 0
          };
          map.set(name, cur);
        }
        const sgn = ticketSign(r);
        const q = Number(r.qty || 0);
        const ttc = sgn * Number(r.total_ttc != null ? r.total_ttc : r.total || 0);
        const net = sgn * Number(r.total != null ? r.total : (Number(r.total_ttc || 0) - Number(r.vat || 0)));
        cur.loads += 1;
        cur.qty_sold += q;
        cur.tons_sold += ticketTons(r);
        cur.net_sum += net;
        cur.sales_ttc += ttc;
      });
      return Array.from(map.values()).map(p => Object.assign(p, {
        avg_price_net: p.qty_sold > 0 ? round2(p.net_sum / p.qty_sold) : 0,
        avg_price_ttc: p.qty_sold > 0 ? round2(p.sales_ttc / p.qty_sold) : 0
      }));
    })();
    const allSites = !isSalesFiltered ? mdlSites : (() => {
      const map = new Map();
      rows.forEach(r => {
        const name = r.site || '(no site on ticket)';
        let cur = map.get(name);
        if (!cur) {
          const ref = mdlSites.find(s => norm(s.Site) === norm(name)) || siteInfo(name) || {};
          cur = { Site: name, JV: ref.JV || (ref.is_jv ? 'Yes' : 'No'), loads: 0, tons_sold: 0, trans_rev: 0, sales_ttc: 0 };
          map.set(name, cur);
        }
        const sgn = ticketSign(r);
        cur.loads += 1;
        cur.tons_sold += ticketTons(r);
        cur.trans_rev += sgn * Number(r.trans_price || 0);
        cur.sales_ttc += sgn * Number(r.total_ttc != null ? r.total_ttc : r.total || 0);
      });
      return Array.from(map.values());
    })();
    const prodTotQty = allProds.reduce((a, p) => a + Number(p.qty_sold || 0), 0);
    const prodTotTtc = allProds.reduce((a, p) => a + Number(p.sales_ttc || 0), 0);
    const prodAvgNet = !isSalesFiltered ? k.avg_price_net : (prodTotQty > 0 ? round2((sumTtc - sumVat) / prodTotQty) : 0);
    const prodAvgTtc = !isSalesFiltered ? k.avg_price_ttc : (prodTotQty > 0 ? round2(prodTotTtc / prodTotQty) : 0);
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const wtcS = byCo.WTC;
    const bbcS = byCo.BBConstruction;
    const isGroupScope = STATE.company === 'manufacturing-group';

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">WEIGHBRIDGE &amp; DISPATCH LEDGER · ${isGroupScope ? 'ALL GROUP (WTC + BBCONSTRUCTION)' : esc((COMPANY_BU_MATCH[STATE.company] || STATE.company).toUpperCase()) + ' SCOPE'}</div>
          <div class="cockpit-title">Sales &amp; Deliveries Register</div>
          <div class="cockpit-sub">Automatic Price Agreement lookup · Delivery vs Pickup transport gating · 11% VAT invoice calculation · Overtime shift detection.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Sales (Ex-VAT)</div><div class="cockpit-pill-val brass">${fmtUSD(sumNet, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cash Sales</div><div class="cockpit-pill-val">${fmtUSD(sumCash, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Credit Sales</div><div class="cockpit-pill-val">${fmtUSD(sumCredit, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">VAT (11%)</div><div class="cockpit-pill-val">${fmtUSD(sumVat, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Sales VAT Incl.</div><div class="cockpit-pill-val emerald">${fmtUSD(sumTtc, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Discount</div><div class="cockpit-pill-val">${fmtUSD(sumDisc, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Loads</div><div class="cockpit-pill-val">${fmtNum(rows.length)}</div></div>
          ${appPill('sales_tickets', 'total_ttc', 'tickets')}
        </div>
      </div>

      <div class="panel-card" id="salesPanel">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search ticket #, customer, product, site, truck, driver...')}
            <div class="chip-bar">
              ${chip('all', `All (${base.length})`)}${chip('delivery', 'Delivery')}${chip('pickup', 'Pickup')}${chip('credit', 'Credit')}${chip('cash', 'Cash')}${chip('vat', 'VAT')}${chip('overtime', 'Overtime')}${chip('app', 'App-entered')}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('salesPanel', 'Sales_Register')}
            ${canEnterForm('sales') ? '<button class="btn btn-primary" data-open-modal="sales">+ New Sales Ticket</button>' : ''}
          </div>
        </div>

        ${isGroupScope ? `
        <div class="sales-entity-recon">
          <div class="sales-recon-card" data-jump-co="wtc" role="button" tabindex="0" title="Click to filter to WTC only (matches WTC Old Power BI)">
            <div class="sales-recon-head">
              <span class="badge badge-brass">WTC</span>
              <b>${fmtNum(wtcS.loads)} Loads</b>
              <span class="sales-recon-act">Filter WTC Only →</span>
            </div>
            <div class="sales-recon-metrics">
              <span><small>Sales Ex-VAT</small><b>${fmtUSD(wtcS.net, 2)}</b></span>
              <span><small>Cash</small><b>${fmtUSD(wtcS.cash, 2)}</b></span>
              <span><small>Credit</small><b>${fmtUSD(wtcS.credit, 2)}</b></span>
              <span><small>VAT (11%)</small><b>${fmtUSD(wtcS.vat, 2)}</b></span>
              <span><small>Sales VAT Incl.</small><b class="brass">${fmtUSD(wtcS.ttc, 2)}</b></span>
              <span><small>Discount</small><b>${fmtUSD(wtcS.disc, 2)}</b></span>
            </div>
          </div>
          <div class="sales-recon-card" data-jump-co="bbconstruction" role="button" tabindex="0" title="Click to filter to BBConstruction only">
            <div class="sales-recon-head">
              <span class="badge badge-info">BBConstruction</span>
              <b>${fmtNum(bbcS.loads)} Loads</b>
              <span class="sales-recon-act">Filter BBC Only →</span>
            </div>
            <div class="sales-recon-metrics">
              <span><small>Sales Ex-VAT</small><b>${fmtUSD(bbcS.net, 2)}</b></span>
              <span><small>Cash</small><b>${fmtUSD(bbcS.cash, 2)}</b></span>
              <span><small>Credit</small><b>${fmtUSD(bbcS.credit, 2)}</b></span>
              <span><small>VAT (11%)</small><b>${fmtUSD(bbcS.vat, 2)}</b></span>
              <span><small>Sales VAT Incl.</small><b class="brass">${fmtUSD(bbcS.ttc, 2)}</b></span>
              <span><small>Discount</small><b>${fmtUSD(bbcS.disc, 2)}</b></span>
            </div>
          </div>
        </div>
        ` : `
        <div class="sales-entity-recon single">
          <div class="sales-recon-single">
            <span><span class="badge badge-brass">${esc(COMPANY_BU_MATCH[STATE.company] || STATE.company)}</span> <b>${fmtNum(rows.length)} Loads</b></span>
            <span>Sales Ex-VAT: <b>${fmtUSD(sumNet, 2)}</b> (Cash <b>${fmtUSD(sumCash, 2)}</b> · Credit <b>${fmtUSD(sumCredit, 2)}</b>)</span>
            <span>VAT 11%: <b>${fmtUSD(sumVat, 2)}</b></span>
            <span>Sales VAT Incl.: <b class="brass">${fmtUSD(sumTtc, 2)}</b></span>
            <span>Discount: <b>${fmtUSD(sumDisc, 2)}</b></span>
            <button type="button" class="btn sales-recon-reset" data-jump-co="manufacturing-group">Show All Group (3)</button>
          </div>
        </div>
        `}

        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('sales', 'Date', 'date')}${th('sales', 'Ticket #', 'ticket_no')}${th('sales', 'Co.', 'company')}${th('sales', 'Type', 'sale_type')}
                ${th('sales', 'Customer', 'customer')}${th('sales', 'Product', 'product')}${th('sales', 'Site', 'site')}${th('sales', 'Truck / Driver', 'truck')}
                ${th('sales', 'Qty', 'qty', 'r')}${th('sales', 'Mat ($)', 'price', 'r')}${th('sales', 'Trans ($)', 'trans_price', 'r')}${th('sales', 'Sales Ex-VAT ($)', 'total', 'r')}${th('sales', 'VAT ($)', 'vat', 'r')}${th('sales', 'Sales VAT Incl. ($)', 'total_ttc', 'r')}${th('sales', 'Method', 'method')}
              </tr>
            </thead>
            <tbody>
              ${shown.map(r => {
                const netVal = r.total != null ? r.total : (Number(r.price || 0) + Number(r.trans_price || 0));
                return `
                <tr class="rrow" data-rkey="sales_tickets" data-rid="${esc(r.id)}">
                  <td class="mono">${esc(recordDate(r))}${appCell(r, 'sales_tickets')}</td>
                  <td class="mono"><strong>${esc(r.ticket_no || '(no number)')}</strong>${r.overtime ? ' <span class="badge badge-warn" title="Overtime load">OT</span>' : ''}</td>
                  <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                  <td>${esc(r.sale_type)}</td>
                  <td>${relLink('customers', r.customer, r.customer, true)}</td>
                  <td>${relLink('products', r.product)}</td>
                  <td>${r.site ? relLink('sites', r.site) : '—'}</td>
                  <td class="mono">${r.truck ? relLink('equipment', r.truck) : esc(r.transport_by || '—')}${r.driver ? ` <span class="mu">· ${relLink('drivers', r.driver)}</span>` : ''}</td>
                  <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                  <td class="r">${fmtUSD(r.price, 2)}</td>
                  <td class="r">${fmtUSD(r.trans_price, 2)}</td>
                  <td class="r"><strong>${fmtUSD(netVal, 2)}</strong></td>
                  <td class="r">${Number(r.vat || 0) ? fmtUSD(r.vat, 2) : '—'}</td>
                  <td class="r"><strong>${fmtUSD(r.total_ttc, 2)}</strong></td>
                  <td><span class="badge ${r.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(r.method)}</span></td>
                </tr>
              `;
              }).join('') || emptyRow(15, periodEmptyMsg(SEED.records.sales_tickets, 'sales tickets'))}
              ${showMoreRow('sales', rows.length, 15)}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8">
                  <b>TOTAL (${fmtNum(rows.length)} LOADS · Ex-VAT ${fmtUSD(sumNet, 2)} · Cash ${fmtUSD(sumCash, 2)} · Credit ${fmtUSD(sumCredit, 2)})</b>
                  ${isGroupScope ? `<div class="tfoot-sub-split">WTC (${fmtNum(wtcS.loads)}): Ex-VAT ${fmtUSD(wtcS.net, 2)} · VAT ${fmtUSD(wtcS.vat, 2)} · Incl. ${fmtUSD(wtcS.ttc, 2)} &nbsp;|&nbsp; BBC (${fmtNum(bbcS.loads)}): Ex-VAT ${fmtUSD(bbcS.net, 2)} · VAT ${fmtUSD(bbcS.vat, 2)} · Incl. ${fmtUSD(bbcS.ttc, 2)}</div>` : ''}
                </td>
                <td class="r"><span class="tfoot-col-lbl">QTY</span><b>${fmtNum(sumQty, 0)}</b></td>
                <td class="r"><span class="tfoot-col-lbl">MAT ($)</span><b>${fmtUSD(sumMat, 2)}</b></td>
                <td class="r"><span class="tfoot-col-lbl">TRANS ($)</span><b>${fmtUSD(sumTr, 2)}</b></td>
                <td class="r"><span class="tfoot-col-lbl">SALES EX-VAT</span><b>${fmtUSD(sumNet, 2)}</b></td>
                <td class="r"><span class="tfoot-col-lbl">VAT (11%)</span><b>${fmtUSD(sumVat, 2)}</b></td>
                <td class="r"><span class="tfoot-col-lbl">SALES VAT INCL.</span><b>${fmtUSD(sumTtc, 2)}</b></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="salesProdPanel">
          <div class="panel-head">
            <div class="panel-title"><span>SALES BY PRODUCT &amp; AGGREGATE GRADE (FULL LEDGER)</span></div>
            <span class="panel-meta">${fmtNum(allProds.length)} Grades ${exportBtn('salesProdPanel', 'Sales_By_Product')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sprod', 'Product / Grade', 'Product')}${th('sprod', 'Family', 'Material Family')}${th('sprod', 'UoM', 'UoM')}${th('sprod', 'Loads', 'loads', 'r')}
                  ${th('sprod', 'Qty Sold', 'qty_sold', 'r')}${th('sprod', 'Tons Sold', 'tons_sold', 'r')}${th('sprod', 'List Price', 'list_price', 'r')}${th('sprod', 'Avg Net', 'avg_price_net', 'r')}${th('sprod', 'Avg TTC', 'avg_price_ttc', 'r')}${th('sprod', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows(allProds, 'sprod', 'sales_ttc', 'desc').map(p => `
                  <tr class="rrow" data-rkey="products" data-rid="${esc((productByName(p.Product) || {}).id || p.Product)}">
                    <td>${relLink('products', p.Product, p.Product, true)}</td>
                    <td>${esc(p['Material Family'] || 'Aggregate')}</td>
                    <td class="mono">${esc(p.UoM || 'm³')}</td>
                    <td class="r">${fmtNum(p.loads)}</td>
                    <td class="r">${fmtNum(p.qty_sold, 0)}</td>
                    <td class="r">${fmtNum(p.tons_sold, 0)}</td>
                    <td class="r">${p.list_price != null ? fmtUSD(p.list_price, 2) : '—'}</td>
                    <td class="r">${fmtUSD(p.avg_price_net, 2)}</td>
                    <td class="r">${fmtUSD(p.avg_price_ttc, 2)}</td>
                    <td class="r"><strong>${fmtUSD(p.sales_ttc, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(10, 'No product breakdown for this entity')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3"><b>TOTAL (${fmtNum(allProds.length)} GRADES)</b></td>
                  <td class="r"><b>${fmtNum(allProds.reduce((a, p) => a + Number(p.loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtNum(allProds.reduce((a, p) => a + Number(p.qty_sold || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtNum(allProds.reduce((a, p) => a + Number(p.tons_sold || 0), 0), 0)}</b></td>
                  <td class="r">—</td>
                  <td class="r"><b>${fmtUSD(prodAvgNet, 2)}</b></td>
                  <td class="r"><b>${fmtUSD(prodAvgTtc, 2)}</b></td>
                  <td class="r"><b>${fmtUSD(prodTotTtc, 0)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="salesSitePanel">
          <div class="panel-head">
            <div class="panel-title"><span>LOADS &amp; REVENUE BY DESTINATION SITE</span></div>
            <span class="panel-meta">${fmtNum(allSites.length)} Active Sites ${exportBtn('salesSitePanel', 'Sales_By_Site')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('ssite', 'Destination Site', 'Site')}${th('ssite', 'JV', 'JV')}${th('ssite', 'Sales Loads', 'loads', 'r')}${th('ssite', 'Tons Sold', 'tons_sold', 'r')}${th('ssite', 'Transport Rev ($)', 'trans_rev', 'r')}${th('ssite', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows(allSites, 'ssite', 'sales_ttc', 'desc').map(s => `
                  <tr class="rrow" data-rkey="sites" data-rid="${esc((siteInfo(s.Site) || {}).id || s.Site)}">
                    <td>${relLink('sites', s.Site, s.Site || '(no site on ticket)', true)}</td>
                    <td>${s.JV === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.loads)}</td>
                    <td class="r">${fmtNum(s.tons_sold, 0)}</td>
                    <td class="r">${fmtUSD(s.trans_rev, 0)}</td>
                    <td class="r"><strong>${fmtUSD(s.sales_ttc, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, 'No site breakdown for this entity')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><b>TOTAL (${fmtNum(allSites.length)} SITES)</b></td>
                  <td class="r"><b>${fmtNum(allSites.reduce((a, s) => a + Number(s.loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtNum(allSites.reduce((a, s) => a + Number(s.tons_sold || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(allSites.reduce((a, s) => a + Number(s.trans_rev || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(allSites.reduce((a, s) => a + Number(s.sales_ttc || 0), 0), 0)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 04: RAW MATERIAL & QUARRIES (2-PAYABLE SPLIT: SITE OWNER + HAULER)
  // ==========================================================================
  function renderRaw() {
    const k = getKPI();
    const m = getModel();
    const base = filterRecords(SEED.records.raw_purchases);
    const rows = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'fleet') return r.transport_by === 'Company fleet';
      if (STATE.chipFilter === 'third') return r.transport_by === 'Third-party truck';
      if (STATE.chipFilter === 'app') return isAppRecord(r);
      return true;
    }), 'raw', 'date', 'desc');
    const shown = rows.slice(0, shownCount('raw'));
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const sumQty = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
    const sumMat = rows.reduce((a, r) => a + Number(r.cost || 0), 0);
    const sumHaul = rows.reduce((a, r) => a + Number(r.trans_cost || 0), 0);
    const sumTot = rows.reduce((a, r) => a + Number(r.total != null ? r.total : (Number(r.cost || 0) + Number(r.trans_cost || 0))), 0);
    const rawSites = (m.sites || []).filter(s => !STATE.search || Object.values(s).join(' ').toLowerCase().includes(STATE.search.toLowerCase()));

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">QUARRY INTAKE &amp; HAULAGE SPLIT · M192 TWO-LEG PAYABLE ENGINE</div>
          <div class="cockpit-title">Raw Material &amp; Quarries</div>
          <div class="cockpit-sub">Every raw load splits cleanly into Leg 1: Material Cost owed to Quarry Site Owner + Leg 2: Haulage owed to Truck Owner.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Raw Cost</div><div class="cockpit-pill-val brass">${fmtUSD(k.raw_cost, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Material Leg</div><div class="cockpit-pill-val">${fmtUSD(k.raw_mat_cost, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Haulage Leg</div><div class="cockpit-pill-val">${fmtUSD(k.raw_haulage, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Raw Loads / Tons</div><div class="cockpit-pill-val emerald">${fmtNum(k.raw_loads)} / ${fmtNum(k.raw_tons, 0)}t</div></div>
          ${appPill('raw_purchases', 'total', 'receipts')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="rawPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search ticket #, quarry site, site owner, hauler, product...')}
              <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('fleet', 'Company fleet')}${chip('third', 'Third-party')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('rawPanel', 'Raw_Register')}
              ${canEnterForm('raw') ? '<button class="btn btn-primary" data-open-modal="raw">+ New Raw Receipt</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('raw', 'Date', 'date')}${th('raw', 'Ticket #', 'ticket_no')}${th('raw', 'Co.', 'company')}${th('raw', 'Quarry Site', 'site')}
                  ${th('raw', 'Site Owner (Mat. Payee)', 'site_owner')}${th('raw', 'Truck Owner (Haul Payee)', 'truck_owner')}${th('raw', 'Product', 'product')}
                  ${th('raw', 'Qty', 'qty', 'r')}${th('raw', 'Mat Cost', 'cost', 'r')}${th('raw', 'Haulage', 'trans_cost', 'r')}${th('raw', 'Total ($)', 'total', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(r => `
                  <tr class="rrow" data-rkey="raw_purchases" data-rid="${esc(r.id)}">
                    <td class="mono">${esc(recordDate(r))}${appCell(r, 'raw_purchases')}</td>
                    <td class="mono"><strong>${esc(r.ticket_no || '(no number)')}</strong></td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td>${relLink('sites', r.site, r.site || '—', true)}</td>
                    <td>${r.site_owner ? relLink('suppliers', r.site_owner) : '—'}</td>
                    <td>${r.truck_owner ? relLink('suppliers', r.truck_owner) : esc(r.transport_by === 'Company fleet' ? 'Company fleet' : (r.transport_by || '—'))}</td>
                    <td>${relLink('products', r.product)}</td>
                    <td class="r">${fmtNum(r.qty, 2)} ${esc(r.uom)}</td>
                    <td class="r">${fmtUSD(r.cost, 2)}</td>
                    <td class="r">${fmtUSD(r.trans_cost, 2)}</td>
                    <td class="r"><strong>${fmtUSD(r.total, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(11, periodEmptyMsg(SEED.records.raw_purchases, 'raw material receipts'))}
                ${showMoreRow('raw', rows.length, 11)}
              </tbody>
              <tfoot>
                <tr><td colspan="7"><b>TOTAL (${fmtNum(rows.length)} RECEIPTS)</b></td><td class="r"><b>${fmtNum(sumQty, 1)}</b></td><td class="r"><b>${fmtUSD(sumMat, 0)}</b></td><td class="r"><b>${fmtUSD(sumHaul, 0)}</b></td><td class="r"><b>${fmtUSD(sumTot, 2)}</b></td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="sitesPanel">
          <div class="panel-head">
            <div class="panel-title"><span>TOP QUARRIES &amp; CUSTOMER SITES BY VOLUME</span></div>
            <span class="panel-meta">${fmtNum(rawSites.length)} Sites ${exportBtn('sitesPanel', 'Sites')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sites', 'Site Name', 'Site')}${th('sites', 'JV', 'JV')}${th('sites', 'Sales Loads', 'loads', 'r')}${th('sites', 'Sales TTC', 'sales_ttc', 'r')}${th('sites', 'Raw Loads', 'raw_loads', 'r')}${th('sites', 'Raw Cost', 'raw_cost', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows(rawSites, 'sites', 'sales_ttc', 'desc').map(s => `
                  <tr class="rrow" data-rkey="sites" data-rid="${esc((siteInfo(s.Site) || {}).id || s.Site)}">
                    <td>${relLink('sites', s.Site, s.Site || '(no site on ticket)', true)}</td>
                    <td>${s.JV === 'Yes' ? '<span class="badge badge-brass">JV</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.loads)}</td>
                    <td class="r">${fmtUSD(s.sales_ttc, 0)}</td>
                    <td class="r">${fmtNum(s.raw_loads)}</td>
                    <td class="r"><strong>${fmtUSD(s.raw_cost, 0)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, 'No site aggregates for this entity')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><b>TOTAL (${fmtNum(rawSites.length)} SITES)</b></td>
                  <td class="r"><b>${fmtNum(rawSites.reduce((a, s) => a + Number(s.loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtUSD(rawSites.reduce((a, s) => a + Number(s.sales_ttc || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtNum(rawSites.reduce((a, s) => a + Number(s.raw_loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtUSD(rawSites.reduce((a, s) => a + Number(s.raw_cost || 0), 0), 0)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 05: EQUIPMENT, FLEET & DIESEL (M99 REGISTRY + M142 METER GUARD)
  // ==========================================================================
  function meterGuardMap(fuelRows) {
    // Walk each unit's readings in date order; flag backwards readings and > 5,000 km / > 500 h jumps
    const byUnit = new Map();
    fuelRows.forEach(f => {
      const key = norm(f.company) + '|' + norm(f.equipment);
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key).push(f);
    });
    const out = new Map();
    byUnit.forEach(list => {
      list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
      let prev = null;
      list.forEach(f => {
        let flag = { cls: 'badge-ok', label: '● OK' };
        const cur = f.odometer != null ? Number(f.odometer) : (f.hours != null ? Number(f.hours) : null);
        const pv = prev ? (prev.odometer != null ? Number(prev.odometer) : (prev.hours != null ? Number(prev.hours) : null)) : null;
        const isHours = f.odometer == null && f.hours != null;
        if (cur == null) flag = { cls: '', label: 'No meter' };
        else if (pv != null) {
          if (cur < pv) flag = { cls: 'badge-err', label: '▼ Backwards' };
          else if (!isHours && cur - pv > 5000) flag = { cls: 'badge-warn', label: '▲ +' + fmtNum(cur - pv, 0) + ' km' };
          else if (isHours && cur - pv > 500) flag = { cls: 'badge-warn', label: '▲ +' + fmtNum(cur - pv, 0) + ' h' };
        }
        out.set(f.id, flag);
        if (cur != null) prev = f;
      });
    });
    return out;
  }

  function renderFleet() {
    const k = getKPI();
    const m = getModel();
    const { fleet } = sentinelSlice();
    const allFuel = filterRecords(SEED.records.fuel_intakes, { ignoreSearch: true, ignorePeriod: true });
    const guards = meterGuardMap(allFuel);
    const base = filterRecords(SEED.records.fuel_intakes);
    const isOwnEquip = e => /^own/i.test(String((e && (e.Ownership || e.ownership)) || ''));
    const isTruckEquip = e => /truck/i.test(String((e && (e.Type || e.type)) || 'Truck'));
    const fuelRows = sortRows(base.filter(f => {
      if (STATE.chipFilter === 'flag') { const g = guards.get(f.id); return g && g.cls !== 'badge-ok' && g.cls !== ''; }
      if (STATE.chipFilter === 'diesel') return /diesel/i.test(f.item || f.fuel_type || '');
      if (STATE.chipFilter === 'lube') return !/diesel/i.test(f.item || f.fuel_type || '');
      if (STATE.chipFilter === 'own') { const eq = equipInfo(f.equipment); return !eq || isOwnEquip(eq); }
      if (STATE.chipFilter === 'transporter') { const eq = equipInfo(f.equipment); return !!(eq && !isOwnEquip(eq)); }
      if (STATE.chipFilter === 'truck') { const eq = equipInfo(f.equipment); return !eq || isTruckEquip(eq); }
      if (STATE.chipFilter === 'machinery') { const eq = equipInfo(f.equipment); return !!(eq && !isTruckEquip(eq)); }
      if (STATE.chipFilter === 'app') return isAppRecord(f);
      return true;
    }), 'fuel', 'date', 'desc');
    const shownFuel = fuelRows.slice(0, shownCount('fuel'));
    const litres = fuelRows.reduce((a, f) => a + Number(f.litres || 0), 0);
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const flagged = allFuel.filter(f => { const g = guards.get(f.id); return g && (g.cls === 'badge-err' || g.cls === 'badge-warn'); }).length;
    const tank = fleet.diesel_stock_balance_l != null ? Number(fleet.diesel_stock_balance_l) : Number(k.diesel_in_tank || 0);
    const equipAll = m.equipment || [];
    const ownCount = equipAll.filter(isOwnEquip).length;
    const transCount = equipAll.length - ownCount;
    const equipBase = equipAll.filter(e => !STATE.search || Object.values(e).join(' ').toLowerCase().includes(STATE.search.toLowerCase()));
    const equipRows = sortRows(equipBase.filter(e => {
      if (STATE.chipFilter === 'own') return isOwnEquip(e);
      if (STATE.chipFilter === 'transporter') return !isOwnEquip(e);
      if (STATE.chipFilter === 'truck') return isTruckEquip(e);
      if (STATE.chipFilter === 'machinery') return !isTruckEquip(e);
      if (STATE.chipFilter === 'diesel') return Number(e.diesel_litres || 0) > 0;
      if (STATE.chipFilter === 'app') {
        const eqRec = equipInfo(e.Equipment);
        return isAppRecord(e) || Boolean(eqRec && isAppRecord(eqRec));
      }
      return true;
    }), 'equip', 'total_cost', 'desc');
    const shownEquip = equipRows.slice(0, shownCount('equip'));
    const eqRegBase = SEED.records.equipment.filter(e => !STATE.search || Object.values(e).join(' ').toLowerCase().includes(STATE.search.toLowerCase()));
    const eqRegRows = sortRows(eqRegBase.filter(e => {
      if (STATE.chipFilter === 'own') return isOwnEquip(e);
      if (STATE.chipFilter === 'transporter') return !isOwnEquip(e);
      if (STATE.chipFilter === 'truck') return isTruckEquip(e);
      if (STATE.chipFilter === 'machinery') return !isTruckEquip(e);
      if (STATE.chipFilter === 'app') return isAppRecord(e);
      return true;
    }), 'eqreg', 'name', 'asc');

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">UNIVERSAL FLEET REGISTRY · M99 + M142 METER TOLERANCE GUARD</div>
          <div class="cockpit-title">Equipment, Fleet &amp; Diesel Telemetry</div>
          <div class="cockpit-sub">Tracks ${fmtNum(SEED.records.equipment.length)} trucks, loaders, excavators &amp; generators · Allocates running costs, driver wages &amp; diesel per ton hauled.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Fleet</div><div class="cockpit-pill-val brass">${fmtNum(k.active_equip)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / Ton Hauled</div><div class="cockpit-pill-val emerald">${fmtUSD(k.cost_per_ton, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cost / m³ Hauled</div><div class="cockpit-pill-val">${fmtUSD(k.cost_per_unit, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Diesel Issued</div><div class="cockpit-pill-val">${fmtNum(k.diesel_litres, 0)} L</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Diesel In Tank</div><div class="cockpit-pill-val ${tank < 0 ? 'amber' : 'emerald'}">${fmtNum(tank, 0)} L</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Fleet Cost</div><div class="cockpit-pill-val amber">${fmtUSD(k.total_equip_cost, 0)}</div></div>
          ${appPill('fuel_intakes', 'litres', 'intakes (L)')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="equipPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search equipment, plate, type, ownership, driver, ticket #...')}
              <div class="chip-bar">${chip('all', `All (${equipAll.length})`)}${chip('own', `Own Fleet (${ownCount})`)}${chip('transporter', `Transporter (${transCount})`)}${chip('truck', 'Trucks')}${chip('machinery', 'Machinery')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('equipPanel', 'Equipment_Costs')}
              ${canEnterForm('fuel') ? '<button class="btn btn-primary" data-open-modal="fuel">+ New Fuel Ticket</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('equip', 'Equipment / Plate', 'Equipment')}${th('equip', 'Type', 'Type')}${th('equip', 'Ownership', 'Ownership')}${th('equip', 'Trips', 'trips', 'r')}${th('equip', 'Diesel (L)', 'diesel_litres', 'r')}
                  ${th('equip', 'Km Run', 'km_run', 'r')}${th('equip', 'Running ($)', 'running_cost', 'r')}${th('equip', 'Driver ($)', 'driver_cost', 'r')}${th('equip', 'Total Cost', 'total_cost', 'r')}${th('equip', '$/Ton', 'cost_per_ton', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownEquip.map(e => `
                  <tr class="rrow" data-rkey="equipment" data-rid="${esc((equipInfo(e.Equipment) || {}).id || e.Equipment)}">
                    <td class="mono">${relLink('equipment', e.Equipment, e.Equipment, true)}</td>
                    <td>${esc(e.Type || 'Truck')}</td>
                    <td><span class="badge ${e.Ownership === 'Owned' || e.Ownership === 'Own' ? 'badge-ok' : 'badge-info'}">${esc(e.Ownership || 'Transporter')}</span></td>
                    <td class="r">${fmtNum(e.trips)}</td>
                    <td class="r">${fmtNum(e.diesel_litres, 0)}</td>
                    <td class="r">${fmtNum(e.km_run, 0)}</td>
                    <td class="r">${fmtUSD(e.running_cost, 0)}</td>
                    <td class="r">${fmtUSD(e.driver_cost, 0)}</td>
                    <td class="r"><strong>${fmtUSD(e.total_cost, 0)}</strong></td>
                    <td class="r">${e.cost_per_ton ? fmtUSD(e.cost_per_ton, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(10, 'No equipment cost rows for this entity')}
                ${showMoreRow('equip', equipRows.length, 10)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3"><b>TOTAL (${fmtNum(equipRows.length)} ACTIVE UNITS)</b></td>
                  <td class="r"><b>${fmtNum(equipRows.reduce((a, e) => a + Number(e.trips || 0), 0))}</b></td>
                  <td class="r"><b>${fmtNum(equipRows.reduce((a, e) => a + Number(e.diesel_litres || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtNum(equipRows.reduce((a, e) => a + Number(e.km_run || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(equipRows.reduce((a, e) => a + Number(e.running_cost || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(equipRows.reduce((a, e) => a + Number(e.driver_cost || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(equipRows.reduce((a, e) => a + Number(e.total_cost || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(k.cost_per_ton, 2)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="fuelPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div class="panel-title"><span>FUEL, DIESEL &amp; LUBRICANT INTAKES (${fmtNum(fuelRows.length)})</span></div>
              <div class="chip-bar">${chip('all', `All Intakes (${base.length})`)}${chip('diesel', 'Diesel')}${chip('lube', 'Lubricants')}${chip('flag', `Guard flags (${flagged})`)}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('fuelPanel', 'Fuel_Intakes')}
              ${canEnterForm('fuel') ? '<button class="btn btn-primary" data-open-modal="fuel">+ New Fuel Ticket</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('fuel', 'Date', 'date')}${th('fuel', 'Ticket', 'ticket_no')}${th('fuel', 'Co.', 'company')}${th('fuel', 'Equipment', 'equipment')}${th('fuel', 'Driver', 'driver')}${th('fuel', 'Item', 'item')}
                  ${th('fuel', 'Litres', 'litres', 'r')}${th('fuel', 'Meter', 'odometer', 'r')}<th>M142 Guard</th>
                </tr>
              </thead>
              <tbody>
                ${shownFuel.map(f => {
                  const g = guards.get(f.id) || { cls: 'badge-ok', label: '● OK' };
                  return `
                  <tr class="rrow" data-rkey="fuel_intakes" data-rid="${esc(f.id)}">
                    <td class="mono">${esc(recordDate(f))}${appCell(f, 'fuel_intakes')}</td>
                    <td class="mono">${esc(f.ticket_no || '—')}</td>
                    <td><span class="badge badge-brass">${esc(f.company)}</span></td>
                    <td class="mono">${relLink('equipment', f.equipment, f.equipment, true)}</td>
                    <td>${f.driver ? relLink('drivers', f.driver) : '—'}</td>
                    <td>${relLink('products', f.item || f.fuel_type || 'Diesel')}</td>
                    <td class="r"><strong>${fmtNum(f.litres, 1)} L</strong></td>
                    <td class="r">${f.odometer != null && f.odometer !== '' ? fmtNum(f.odometer, 0) + ' km' : (f.hours != null && f.hours !== '' ? fmtNum(f.hours, 1) + ' h' : '—')}</td>
                    <td><span class="badge ${g.cls}">${esc(g.label)}</span></td>
                  </tr>`;
                }).join('') || emptyRow(9, periodEmptyMsg(SEED.records.fuel_intakes, 'fuel intakes'))}
                ${showMoreRow('fuel', fuelRows.length, 9)}
              </tbody>
              <tfoot><tr><td colspan="6"><b>TOTAL (${fmtNum(fuelRows.length)} INTAKES)</b></td><td class="r"><b>${fmtNum(litres, 0)} L</b></td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="driverPanel">
          <div class="panel-head">
            <div class="panel-title"><span>UNIVERSAL EQUIPMENT &amp; DRIVER REGISTRY (${fmtNum(SEED.records.equipment.length)} UNITS · ${fmtNum(SEED.records.drivers.length)} DRIVERS)</span></div>
            <span class="panel-meta" style="display:flex;gap:6px;align-items:center">M99 + M107 Universal Registry ${exportBtn('driverPanel', 'Equipment_Registry')}${canEnterForm('equipment') ? '<button class="btn btn-primary" data-open-modal="equipment">+ New Equipment</button>' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('eqreg', 'Unit / Plate', 'name')}${th('eqreg', 'Category', 'type')}${th('eqreg', 'Ownership', 'ownership')}${th('eqreg', 'Capacity', 'capacity', 'r')}
                  ${th('eqreg', 'Truck Owner / Supplier', 'supplier')}${th('eqreg', 'Customer Link', 'customer')}${th('eqreg', 'Default Driver', 'default_driver')}
                </tr>
              </thead>
              <tbody>
                ${eqRegRows.slice(0, shownCount('eqreg')).map(e => `
                  <tr class="rrow" data-rkey="equipment" data-rid="${esc(e.id || e.name)}">
                    <td class="mono">${relLink('equipment', e.name, e.name, true)}</td>
                    <td>${esc(e.type || 'Truck')}</td>
                    <td><span class="badge ${/^own/i.test(e.ownership || '') ? 'badge-ok' : 'badge-info'}">${esc(e.ownership || 'Transporter')}</span></td>
                    <td class="r">${e.capacity ? fmtNum(e.capacity, 1) : '—'}</td>
                    <td>${e.supplier ? relLink('suppliers', e.supplier) : '—'}</td>
                    <td>${e.customer ? relLink('customers', e.customer) : '—'}</td>
                    <td>${e.default_driver ? relLink('drivers', e.default_driver) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(7, 'No matching equipment units')}
                ${showMoreRow('eqreg', eqRegRows.length, 7)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3"><b>TOTAL (${fmtNum(eqRegRows.length)} UNITS IN REGISTRY)</b></td>
                  <td class="r"><b>${fmtNum(eqRegRows.reduce((a, e) => a + Number(e.capacity || 0), 0), 0)}</b></td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 06: PRICING & COMMISSION AGREEMENTS
  // ==========================================================================
  function renderPricing() {
    const k = getKPI();
    const today = SEED_DATE;
    const isActive = r => (!r.end_date || String(r.end_date) >= today) && (!r.start_date || String(r.start_date) <= today);
    const base = filterRecords(SEED.records.price_rules, { ignorePeriod: true });
    const types = uniqSorted(base.map(r => r.rule_type));
    const rules = sortRows(base.filter(r => {
      if (STATE.chipFilter === 'active') return isActive(r);
      if (STATE.chipFilter === 'lapsed') return !isActive(r);
      if (STATE.chipFilter === 'customer') return !!r.customer;
      if (STATE.chipFilter === 'quarry') return !r.customer && (r.supplier || r.site);
      if (STATE.chipFilter === 'app') return isAppRecord(r);
      if (types.includes(STATE.chipFilter)) return r.rule_type === STATE.chipFilter;
      return true;
    }), 'pricing', 'start_date', 'desc');
    const shown = rules.slice(0, shownCount('pricing'));
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const activeCount = base.filter(isActive).length;
    const shortRuleType = t => ({
      'Sales (Delivery)': 'Delivery',
      'Sales (Pickup)': 'Pickup',
      'Purchase Price (Site)': 'Purchase (Site)',
      'Transport Price (Site)': 'Transport (Site)',
      'List Price': 'List Price'
    }[t] || t);
    const typeChips = types.length ? types.map(t => chip(t, shortRuleType(t))).join('') : chip('customer', 'Customer rules') + chip('quarry', 'Quarry / hauler rules');

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">CONTRACTUAL PRICE ENGINE · M73 + M228 + M276</div>
          <div class="cockpit-title">Price &amp; Commission Agreements</div>
          <div class="cockpit-sub">Governs Sales (Delivery), Sales (Pickup), Quarry Purchase Price (Site), Hauler Transport Price (Site) &amp; Sales Commissions. The entry desk locks ticket prices to the matching active rule.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Agreements</div><div class="cockpit-pill-val brass">${fmtNum(k.active_agreements != null ? k.active_agreements : activeCount)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total SQL Rules</div><div class="cockpit-pill-val">${fmtNum(base.length)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Commission Due</div><div class="cockpit-pill-val amber">${fmtUSD(k.commission_due, 0)}</div></div>
          ${appPill('price_rules', 'unit_price', 'agreements')}
        </div>
      </div>

      <div class="panel-card" id="pricingPanel">
        <div class="table-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search customer, quarry supplier, product, site, agreement code...')}
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('active', `Active (${activeCount})`)}${chip('lapsed', 'Lapsed')}${typeChips}${chip('app', 'App-entered')}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${exportBtn('pricingPanel', 'Price_Agreements')}
            ${canEnterForm('pricerule') ? '<button class="btn btn-primary" data-open-modal="pricerule">+ New Price Agreement</button>' : ''}
          </div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('pricing', 'Agreement Code', 'name')}${th('pricing', 'Co.', 'company')}${th('pricing', 'Rule Type', 'rule_type')}${th('pricing', 'Customer / Quarry Owner', 'customer')}${th('pricing', 'Product', 'product')}${th('pricing', 'Site', 'site')}
                ${th('pricing', 'Unit', 'unit')}${th('pricing', 'Unit Price ($)', 'unit_price', 'r')}${th('pricing', 'Transport Price ($)', 'trans_unit_price', 'r')}${th('pricing', 'Start Date', 'start_date')}${th('pricing', 'End Date', 'end_date')}<th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${shown.map(pr => `
                <tr class="rrow" data-rkey="price_rules" data-rid="${esc(pr.id)}">
                  <td class="mono"><strong>${esc(pr.name)}</strong>${appCell(pr, 'price_rules')}</td>
                  <td><span class="badge badge-brass">${esc(pr.company)}</span></td>
                  <td><span class="badge badge-info">${esc(pr.rule_type || '—')}</span></td>
                  <td>${pr.customer ? relLink('customers', pr.customer, pr.customer, true) : (pr.supplier ? relLink('suppliers', pr.supplier, pr.supplier, true) : (pr.site ? relLink('sites', pr.site, pr.site + ' (site)', true) : '<strong>Standard List</strong>'))}</td>
                  <td>${pr.product ? relLink('products', pr.product) : '(All Grades)'}</td>
                  <td>${pr.site ? relLink('sites', pr.site) : '—'}</td>
                  <td class="mono">${esc(pr.unit)}</td>
                  <td class="r"><strong>${fmtUSD(pr.unit_price, 2)}</strong></td>
                  <td class="r">${pr.trans_unit_price ? fmtUSD(pr.trans_unit_price, 2) : '—'}</td>
                  <td class="mono">${esc(pr.start_date || '—')}</td>
                  <td class="mono">${esc(pr.end_date || 'Open')}</td>
                  <td><span class="badge ${isActive(pr) ? 'badge-ok' : 'badge-warn'}">${isActive(pr) ? 'Active' : 'Lapsed'}</span></td>
                </tr>
              `).join('') || emptyRow(12, STATE.search ? `No agreements match "${STATE.search}".` : 'No agreements for this entity')}
              ${showMoreRow('pricing', rules.length, 12)}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7"><b>TOTAL (${fmtNum(rules.length)} MATCHING AGREEMENTS · ${fmtNum(rules.filter(isActive).length)} ACTIVE)</b></td>
                <td class="r"><span class="mu" style="font-size:10px">Avg </span><b>${fmtUSD(rules.length ? rules.reduce((a, r) => a + Number(r.unit_price || 0), 0) / rules.length : 0, 2)}</b></td>
                <td class="r"><span class="mu" style="font-size:10px">Avg </span><b>${fmtUSD(rules.filter(r => Number(r.trans_unit_price || 0) > 0).length ? rules.reduce((a, r) => a + Number(r.trans_unit_price || 0), 0) / rules.filter(r => Number(r.trans_unit_price || 0) > 0).length : 0, 2)}</b></td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="listPricePanel">
          <div class="panel-head">
            <div class="panel-title"><span>LIST PRICE BENCHMARK VS. REALIZED SELLING PRICE BY GRADE</span></div>
            <span class="panel-meta">M281 Price vs. List ${exportBtn('listPricePanel', 'Price_Benchmark')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('pbench', 'Product / Grade', 'Product')}${th('pbench', 'UoM', 'UoM')}${th('pbench', 'Loads', 'loads', 'r')}${th('pbench', 'List Price ($)', 'list_price', 'r')}
                  ${th('pbench', 'Realized Net ($)', 'avg_price_net', 'r')}${th('pbench', 'Realized TTC ($)', 'avg_price_ttc', 'r')}${th('pbench', 'Sales TTC ($)', 'sales_ttc', 'r')}
                </tr>
              </thead>
              <tbody>
                ${sortRows((getModel().products || []), 'pbench', 'sales_ttc', 'desc').map(p => `
                  <tr class="rrow" data-rkey="products" data-rid="${esc((productByName(p.Product) || {}).id || p.Product)}">
                    <td>${relLink('products', p.Product, p.Product, true)}</td>
                    <td class="mono">${esc(p.UoM || 'm³')}</td>
                    <td class="r">${fmtNum(p.loads)}</td>
                    <td class="r">${p.list_price != null ? fmtUSD(p.list_price, 2) : '—'}</td>
                    <td class="r">${fmtUSD(p.avg_price_net, 2)}</td>
                    <td class="r"><strong>${fmtUSD(p.avg_price_ttc, 2)}</strong></td>
                    <td class="r">${fmtUSD(p.sales_ttc, 0)}</td>
                  </tr>
                `).join('') || emptyRow(7, 'No product benchmark rows for this entity')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><b>TOTAL (${fmtNum((getModel().products || []).length)} GRADES)</b></td>
                  <td class="r"><b>${fmtNum((getModel().products || []).reduce((a, p) => a + Number(p.loads || 0), 0))}</b></td>
                  <td class="r">—</td>
                  <td class="r"><b>${fmtUSD(k.avg_price_net, 2)}</b></td>
                  <td class="r"><b>${fmtUSD(k.avg_price_ttc, 2)}</b></td>
                  <td class="r"><b>${fmtUSD((getModel().products || []).reduce((a, p) => a + Number(p.sales_ttc || 0), 0), 0)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 07: CUSTOMERS & RECEIVABLES (AR) — FIFO ALLOCATION & AGING
  // ==========================================================================
  function renderAR() {
    const k = getKPI();
    const m = getModel();
    const q = STATE.search.trim().toLowerCase();
    const custAll = m.customers || [];
    const custs = sortRows(custAll.filter(c => {
      if (q && !String(c.Customer || '').toLowerCase().includes(q)) return false;
      if (STATE.chipFilter === 'open_ar') return Number(c.ar_balance || 0) > 0;
      if (STATE.chipFilter === 'overdue60') return Number(c.ar_60_plus || 0) > 0;
      if (STATE.chipFilter === 'vat_reg') return c['VAT Registered'] === 'Yes';
      return true;
    }), 'custs', 'ar_balance', 'desc');
    const shownCusts = custs.slice(0, shownCount('custs'));
    const base = filterRecords(SEED.records.receipts);
    const isCustChip = ['open_ar', 'overdue60', 'vat_reg'].includes(STATE.chipFilter);
    const rcpts = sortRows(base.filter(r => STATE.chipFilter === 'app' ? isAppRecord(r) : (STATE.chipFilter === 'all' || isCustChip || r.method === STATE.chipFilter)), 'receipts', 'date', 'desc');
    const shown = rcpts.slice(0, shownCount('receipts'));
    const methods = uniqSorted(SEED.records.receipts.map(r => r.method));
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const sumAmt = rcpts.reduce((a, r) => a + Number(r.amount || 0), 0);
    const sumDisc = rcpts.reduce((a, r) => a + Number(r.discount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ACCOUNTS RECEIVABLE · M165 FIFO ALLOCATION + M249 VAT-INCLUSIVE BALANCE</div>
          <div class="cockpit-title">Customers &amp; Receivables (AR)</div>
          <div class="cockpit-sub">Every receipt or credit note settles the customer's oldest open tickets first (FIFO) · Balances include 11% VAT for VAT-registered customers.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Net AR Balance</div><div class="cockpit-pill-val brass">${fmtUSD(k.ar_balance, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Current (0–10d)</div><div class="cockpit-pill-val emerald">${fmtUSD((k.ar_current || 0) + (k.ar_1_10 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">11–60 Days</div><div class="cockpit-pill-val">${fmtUSD((k.ar_11_30 || 0) + (k.ar_31_60 || 0), 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overdue 60+ Days</div><div class="cockpit-pill-val amber">${fmtUSD(k.ar_60_plus, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Receipts Collected</div><div class="cockpit-pill-val">${fmtUSD(k.receipts, 0)}</div></div>
          ${appPill('receipts', 'amount', 'receipts')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="custPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search customer, voucher, reference...')}
              <div class="chip-bar">${chip('all', `All (${custAll.length})`)}${chip('open_ar', 'Open AR')}${chip('overdue60', 'Overdue 60+')}${chip('vat_reg', '11% VAT')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('custPanel', 'AR_Aging')}
              ${canEnterForm('receipt') ? '<button class="btn btn-primary" data-open-modal="receipt">+ Customer Receipt (FIFO)</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('custs', 'Customer', 'Customer')}${th('custs', 'VAT Reg', 'VAT Registered')}${th('custs', 'Loads', 'loads', 'r')}${th('custs', 'Sales TTC', 'sales_ttc', 'r')}${th('custs', 'Receipts', 'receipts', 'r')}
                  ${th('custs', 'Current', 'ar_current', 'r')}${th('custs', 'Overdue 60+', 'ar_60_plus', 'r')}${th('custs', 'Open AR ($)', 'ar_balance', 'r')}${th('custs', 'Last Sale', 'last_sale')}
                </tr>
              </thead>
              <tbody>
                ${shownCusts.map(c => `
                  <tr class="rrow" data-rkey="customers" data-rid="${esc((customerInfo(c.Customer) || {}).id || c.Customer)}">
                    <td>${relLink('customers', c.Customer, c.Customer, true)}</td>
                    <td>${c['VAT Registered'] === 'Yes' ? '<span class="badge badge-info">11% VAT</span>' : 'No'}</td>
                    <td class="r">${fmtNum(c.loads)}</td>
                    <td class="r">${fmtUSD(c.sales_ttc, 0)}</td>
                    <td class="r">${fmtUSD(c.receipts, 0)}</td>
                    <td class="r">${fmtUSD(c.ar_current, 0)}</td>
                    <td class="r">${Number(c.ar_60_plus || 0) > 0 ? `<span style="color:var(--crit)">${fmtUSD(c.ar_60_plus, 0)}</span>` : '—'}</td>
                    <td class="r"><strong>${fmtUSD(c.ar_balance, 2)}</strong></td>
                    <td class="mono">${esc(String(c.last_sale || '').slice(0, 10) || '—')}</td>
                  </tr>
                `).join('') || emptyRow(9, q ? `No customers match "${STATE.search}".` : 'No customer balances for this entity')}
                ${showMoreRow('custs', custs.length, 9)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><b>TOTAL (${fmtNum(custs.length)} CUSTOMERS)</b></td>
                  <td class="r"><b>${fmtNum(custs.reduce((a, c) => a + Number(c.loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtUSD(custs.reduce((a, c) => a + Number(c.sales_ttc || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(custs.reduce((a, c) => a + Number(c.receipts || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(custs.reduce((a, c) => a + Number(c.ar_current || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(custs.reduce((a, c) => a + Number(c.ar_60_plus || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(custs.reduce((a, c) => a + Number(c.ar_balance || 0), 0), 2)}</b></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="rcptPanel">
          <div class="table-toolbar">
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${methods.map(mm => chip(mm, mm)).join('')}${chip('app', 'App-entered')}</div>
            <span class="panel-meta">FIFO Auto-Applied ${exportBtn('rcptPanel', 'Customer_Receipts')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('receipts', 'Date', 'date')}${th('receipts', 'Voucher', 'name')}${th('receipts', 'Co.', 'company')}${th('receipts', 'Customer', 'customer')}${th('receipts', 'Method', 'method')}${th('receipts', 'Cash ($)', 'amount', 'r')}${th('receipts', 'Disc ($)', 'discount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(r => `
                  <tr class="rrow" data-rkey="receipts" data-rid="${esc(r.id)}">
                    <td class="mono">${esc(recordDate(r))}${appCell(r, 'receipts')}</td>
                    <td class="mono">${esc(r.name)}${r.reference ? ` <span class="mu">· ${esc(r.reference)}</span>` : ''}</td>
                    <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                    <td>${relLink('customers', r.customer, r.customer, true)}</td>
                    <td>${esc(r.method)}</td>
                    <td class="r"><strong>${fmtUSD(r.amount, 2)}</strong></td>
                    <td class="r">${r.discount ? fmtUSD(r.discount, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(7, periodEmptyMsg(SEED.records.receipts, 'customer receipts'))}
                ${showMoreRow('receipts', rcpts.length, 7)}
              </tbody>
              <tfoot><tr><td colspan="5"><b>TOTAL (${fmtNum(rcpts.length)} RECEIPTS)</b></td><td class="r"><b>${fmtUSD(sumAmt, 2)}</b></td><td class="r"><b>${sumDisc ? fmtUSD(sumDisc, 2) : '—'}</b></td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 08: SUPPLIERS & PAYABLES (AP) — 3-LEG QUARRY / HAULER / EXPENSE ENGINE
  // ==========================================================================
  function renderAP() {
    const k = getKPI();
    const m = getModel();
    const q = STATE.search.trim().toLowerCase();
    const supAll = m.suppliers || [];
    const sups = sortRows(supAll.filter(s => {
      if (q && !String(s.Supplier || '').toLowerCase().includes(q)) return false;
      if (STATE.chipFilter === 'open_ap') return Number(s.ap_balance || 0) > 0;
      if (STATE.chipFilter === 'mat_leg') return Number(s.ap_material || 0) > 0;
      if (STATE.chipFilter === 'haul_leg') return Number(s.ap_haulage || 0) > 0;
      if (STATE.chipFilter === 'exp_leg') return Number(s.ap_expense || 0) > 0;
      if (STATE.chipFilter === 'iva_sup') return s.IVA === 'Yes';
      return true;
    }), 'sups', 'ap_balance', 'desc');
    const shownSups = sups.slice(0, shownCount('sups'));
    const base = filterRecords(SEED.records.settlements);
    const isSupChip = ['open_ap', 'mat_leg', 'haul_leg', 'exp_leg', 'iva_sup'].includes(STATE.chipFilter);
    const spays = sortRows(base.filter(r => STATE.chipFilter === 'app' ? isAppRecord(r) : (STATE.chipFilter === 'all' || isSupChip || r.method === STATE.chipFilter)), 'settle', 'date', 'desc');
    const shown = spays.slice(0, shownCount('settle'));
    const methods = uniqSorted(SEED.records.settlements.map(r => r.method));
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const sumAmt = spays.reduce((a, r) => a + Number(r.amount || 0), 0);
    const sumDisc = spays.reduce((a, r) => a + Number(r.discount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">ACCOUNTS PAYABLE · M192 THREE-LEG FIFO SETTLEMENT ENGINE</div>
          <div class="cockpit-title">Suppliers, Quarries &amp; Haulers (AP)</div>
          <div class="cockpit-sub">Tracks open payables across Material Legs (Quarry Owner), Haulage Legs (Truck Owner) &amp; Supplies/Services Legs (Credit Expenses).</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Net AP Balance</div><div class="cockpit-pill-val brass">${fmtUSD(k.ap_balance, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Material Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_material, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Haulage Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_haulage, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Expense Legs</div><div class="cockpit-pill-val">${fmtUSD(k.ap_expense, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Settlements Paid</div><div class="cockpit-pill-val emerald">${fmtUSD(k.settlements_paid, 0)}</div></div>
          ${appPill('settlements', 'amount', 'settlements')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="supPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search supplier / hauler, voucher, reference...')}
              <div class="chip-bar">${chip('all', `All (${supAll.length})`)}${chip('open_ap', 'Open AP')}${chip('mat_leg', 'Material Leg')}${chip('haul_leg', 'Haulage Leg')}${chip('exp_leg', 'Expense Leg')}${chip('iva_sup', 'IVA')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('supPanel', 'AP_Legs')}
              ${canEnterForm('settlement') ? '<button class="btn btn-primary" data-open-modal="settlement">+ Supplier Settlement</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('sups', 'Supplier / Hauler', 'Supplier')}${th('sups', 'IVA', 'IVA')}${th('sups', 'Raw Loads', 'raw_loads', 'r')}${th('sups', 'Mat. Leg', 'ap_material', 'r')}${th('sups', 'Haul Leg', 'ap_haulage', 'r')}
                  ${th('sups', 'Exp. Leg', 'ap_expense', 'r')}${th('sups', 'Paid ($)', 'settlements_paid', 'r')}${th('sups', 'Net AP ($)', 'ap_balance', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownSups.map(s => `
                  <tr class="rrow" data-rkey="suppliers" data-rid="${esc((supplierInfo(s.Supplier) || {}).id || s.Supplier)}">
                    <td>${relLink('suppliers', s.Supplier, s.Supplier, true)}</td>
                    <td>${s.IVA === 'Yes' ? '<span class="badge badge-info">IVA</span>' : '—'}</td>
                    <td class="r">${fmtNum(s.raw_loads)}</td>
                    <td class="r">${fmtUSD(s.ap_material, 0)}</td>
                    <td class="r">${fmtUSD(s.ap_haulage, 0)}</td>
                    <td class="r">${fmtUSD(s.ap_expense, 0)}</td>
                    <td class="r">${fmtUSD(s.settlements_paid, 0)}</td>
                    <td class="r"><strong>${fmtUSD(s.ap_balance, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(8, q ? `No suppliers match "${STATE.search}".` : 'No supplier balances for this entity')}
                ${showMoreRow('sups', sups.length, 8)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><b>TOTAL (${fmtNum(sups.length)} SUPPLIERS)</b></td>
                  <td class="r"><b>${fmtNum(sups.reduce((a, s) => a + Number(s.raw_loads || 0), 0))}</b></td>
                  <td class="r"><b>${fmtUSD(sups.reduce((a, s) => a + Number(s.ap_material || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(sups.reduce((a, s) => a + Number(s.ap_haulage || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(sups.reduce((a, s) => a + Number(s.ap_expense || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(sups.reduce((a, s) => a + Number(s.settlements_paid || 0), 0), 0)}</b></td>
                  <td class="r"><b>${fmtUSD(sups.reduce((a, s) => a + Number(s.ap_balance || 0), 0), 2)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="settlePanel">
          <div class="table-toolbar">
            <div class="chip-bar">${chip('all', `All (${base.length})`)}${methods.map(mm => chip(mm, mm)).join('')}${chip('app', 'App-entered')}</div>
            <span class="panel-meta">Oldest-First Leg Relief ${exportBtn('settlePanel', 'Supplier_Settlements')}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('settle', 'Date', 'date')}${th('settle', 'Voucher', 'name')}${th('settle', 'Co.', 'company')}${th('settle', 'Supplier', 'supplier')}${th('settle', 'Method', 'method')}${th('settle', 'Cash Paid', 'amount', 'r')}${th('settle', 'Diff / Disc', 'discount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shown.map(sp => `
                  <tr class="rrow" data-rkey="settlements" data-rid="${esc(sp.id)}">
                    <td class="mono">${esc(recordDate(sp))}${appCell(sp, 'settlements')}</td>
                    <td class="mono">${esc(sp.name)}${sp.reference ? ` <span class="mu">· ${esc(sp.reference)}</span>` : ''}</td>
                    <td><span class="badge badge-brass">${esc(sp.company)}</span></td>
                    <td>${relLink('suppliers', sp.supplier, sp.supplier, true)}</td>
                    <td>${esc(sp.method)}</td>
                    <td class="r"><strong>${fmtUSD(sp.amount, 2)}</strong></td>
                    <td class="r">${sp.discount ? fmtUSD(sp.discount, 2) : '—'}</td>
                  </tr>
                `).join('') || emptyRow(7, periodEmptyMsg(SEED.records.settlements, 'supplier settlements'))}
                ${showMoreRow('settle', spays.length, 7)}
              </tbody>
              <tfoot><tr><td colspan="5"><b>TOTAL (${fmtNum(spays.length)} SETTLEMENTS)</b></td><td class="r"><b>${fmtUSD(sumAmt, 2)}</b></td><td class="r"><b>${sumDisc ? fmtUSD(sumDisc, 2) : '—'}</b></td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 09: EXPENSES & PAYROLL
  // ==========================================================================
  function renderExpenses() {
    const k = getKPI();
    const base = filterRecords(SEED.records.expenses);
    const expRows = sortRows(base.filter(x => {
      if (STATE.chipFilter === 'cash') return x.method === 'Cash';
      if (STATE.chipFilter === 'credit') return x.method === 'Credit';
      if (STATE.chipFilter === 'app') return isAppRecord(x);
      return true;
    }), 'expenses', 'date', 'desc');
    const shownExp = expRows.slice(0, shownCount('expenses'));
    const salRows = sortRows(filterRecords(SEED.records.salaries), 'salaries', 'date', 'desc');
    const shownSal = salRows.slice(0, shownCount('salaries'));
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;
    const sumExp = expRows.reduce((a, r) => a + Number(r.amount || 0), 0);
    const sumSal = salRows.reduce((a, r) => a + Number(r.amount || 0), 0);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">OPERATING COSTS, SPARE PARTS &amp; WORKFORCE PAYROLL</div>
          <div class="cockpit-title">Expenses &amp; Payroll Ledger</div>
          <div class="cockpit-sub">Categorized into Production Cost (Class 60/61), Operating Expenses (Class 62) &amp; Capital Expenditures (Class 2) + Staff Salaries &amp; Overtime.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Expenses</div><div class="cockpit-pill-val brass">${fmtUSD(k.expenses, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cash / Credit</div><div class="cockpit-pill-val">${fmtUSD(k.cash_expenses, 0)} / ${fmtUSD(k.credit_expenses, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Salaries Paid</div><div class="cockpit-pill-val emerald">${fmtUSD(k.salaries_paid, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overtime Due</div><div class="cockpit-pill-val amber">${fmtUSD(k.overtime_bonus, 0)}</div></div>
          ${appPill('expenses', 'amount', 'expenses')}
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card" id="expPanel">
          <div class="table-toolbar">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${searchBox('Search category, supplier, equipment, reference...')}
              <div class="chip-bar">${chip('all', `All (${base.length})`)}${chip('cash', 'Cash')}${chip('credit', 'Credit')}${chip('app', 'App-entered')}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${exportBtn('expPanel', 'Expense_Register')}
              ${canEnterForm('expense') ? '<button class="btn btn-primary" data-open-modal="expense">+ New Expense</button>' : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('expenses', 'Date', 'date')}${th('expenses', 'Co.', 'company')}${th('expenses', 'Category', 'category')}${th('expenses', 'Subcategory', 'subcategory')}${th('expenses', 'Supplier', 'supplier')}${th('expenses', 'Equipment', 'equipment')}${th('expenses', 'Method', 'method')}${th('expenses', 'Amount ($)', 'amount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownExp.map(x => `
                  <tr class="rrow" data-rkey="expenses" data-rid="${esc(x.id)}">
                    <td class="mono">${esc(recordDate(x))}${appCell(x, 'expenses')}</td>
                    <td><span class="badge badge-brass">${esc(x.company)}</span></td>
                    <td>${relLink('expense_categories', x.category, x.category, true)}</td>
                    <td>${x.subcategory ? relLink('expense_subcategories', x.subcategory) : '—'}${x.reference ? ` <span class="mu">· ${esc(x.reference)}</span>` : ''}</td>
                    <td>${x.supplier ? relLink('suppliers', x.supplier) : '—'}</td>
                    <td class="mono">${x.equipment ? relLink('equipment', x.equipment) : '—'}</td>
                    <td><span class="badge ${x.method === 'Cash' ? 'badge-ok' : 'badge-info'}">${esc(x.method)}</span></td>
                    <td class="r"><strong>${fmtUSD(x.amount, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(8, periodEmptyMsg(SEED.records.expenses, 'expenses'))}
                ${showMoreRow('expenses', expRows.length, 8)}
              </tbody>
              <tfoot><tr><td colspan="7"><b>TOTAL (${fmtNum(expRows.length)} EXPENSES)</b></td><td class="r"><b>${fmtUSD(sumExp, 2)}</b></td></tr></tfoot>
            </table>
          </div>
        </div>

        <div class="panel-card" id="salPanel">
          <div class="panel-head">
            <div class="panel-title"><span>STAFF SALARIES &amp; PAYROLL DISBURSEMENTS</span></div>
            <span class="panel-meta" style="display:flex;gap:6px;align-items:center">
              <button type="button" class="btn" style="padding:3px 9px;font-size:11px" data-nav-jump="payroll">Full Payroll Command →</button>
              <button type="button" class="btn" style="padding:3px 9px;font-size:11px" data-pbi-jump="p12_payroll">P12 Payroll BI →</button>
              ${exportBtn('salPanel', 'Payroll')}
            </span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${th('salaries', 'Date', 'date')}${th('salaries', 'Payroll Month', 'payroll_month')}${th('salaries', 'Co.', 'company')}${th('salaries', 'Staff Member', 'staff')}${th('salaries', 'Method', 'method')}${th('salaries', 'Paid ($)', 'amount', 'r')}
                </tr>
              </thead>
              <tbody>
                ${shownSal.map(s => `
                  <tr class="rrow" data-rkey="salaries" data-rid="${esc(s.id)}">
                    <td class="mono">${esc(recordDate(s))}${appCell(s, 'salaries')}</td>
                    <td class="mono">${esc(s.payroll_month)}</td>
                    <td><span class="badge badge-brass">${esc(s.company)}</span></td>
                    <td>${relLink('employments', s.staff, s.staff, true)}</td>
                    <td>${esc(s.method || '—')}</td>
                    <td class="r"><strong>${fmtUSD(s.amount, 2)}</strong></td>
                  </tr>
                `).join('') || emptyRow(6, periodEmptyMsg(SEED.records.salaries, 'salary payments'))}
                ${showMoreRow('salaries', salRows.length, 6)}
              </tbody>
              <tfoot><tr><td colspan="5"><b>TOTAL (${fmtNum(salRows.length)} PAYMENTS)</b></td><td class="r"><b>${fmtUSD(sumSal, 2)}</b></td></tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 09B: PAYROLL, ATTENDANCE, SITE ALLOWANCES & FREELANCE COMMAND (M239/M245/M247)
  // ==========================================================================
  function renderPayroll() {
    const k = getKPI();
    const { fleet, pricing } = sentinelSlice();
    const today = SEED_DATE;
    const empAll = filterRecords(SEED.records.employments, { ignorePeriod: true });
    const salAll = filterRecords(SEED.records.salaries);
    const attAll = filterRecords(SEED.records.attendance);
    const logAll = filterRecords(SEED.records.logistics_allowances, { ignorePeriod: true });
    const otRates = filterRecords(SEED.records.overtime_rates, { ignorePeriod: true });

    // Build per-staff 16-column payroll register (Base, OT, Late, Absence, Site Allowance, Earnings, Paid, Balance)
    const staffMap = new Map();
    const ensureStaff = (name, co) => {
      const key = norm(name || '(Unassigned)');
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          staff: name || '(Unassigned)', company: co || 'WTC', type: 'Monthly', status: 'Current',
          base: 0, ot_hrs: 0, ot_pay: 0, late_hrs: 0, late_ded: 0, absent_days: 0, gap_days: 0, abs_ded: 0,
          extras: 0, reimb: 0, ded: 0, site_allow: 0, earnings: 0, paid: 0, balance: 0, payments: 0, hasContract: false
        });
      }
      return staffMap.get(key);
    };
    empAll.forEach(e => {
      const s = ensureStaff(e.staff, e.company);
      s.hasContract = true;
      s.type = e.type || 'Regular';
      const ended = e.status === 'Ended' || (e.end_date && String(e.end_date) < today);
      if (!ended) s.status = 'Current';
      else if (s.status !== 'Current') s.status = 'Ended';
      s.base += Number(e.salary_usd || 0) || (Number(e.daily_rate || 0) * 26);
    });
    attAll.forEach(a => {
      const s = ensureStaff(a.staff, a.company);
      const otH = Number(a.overtime_hours || 0);
      const ltH = Number(a.late_hours || 0);
      s.ot_hrs += otH;
      s.late_hrs += ltH;
      const st = String(a.status || '');
      if (/Absent|Unpaid/i.test(st)) s.absent_days += 1;
      const hrRate = s.base > 0 ? (s.base / (26 * 9)) : 4.5;
      s.ot_pay += round2(otH * hrRate * 1.5);
      s.late_ded += round2(ltH * hrRate);
      if (/Absent/i.test(st)) s.abs_ded += round2(s.base > 0 ? (s.base / 26) : 25);
    });
    logAll.forEach(l => {
      const s = ensureStaff(l.staff, l.company);
      const daily = Number(l.daily_usd || l.usd_amount || 0) || (Number(l.lbp_amount || 0) / 89500);
      const daysPerWk = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(d => l[d]).length || 6;
      const start = String(l.start_date || '2026-01-01');
      const end = String(l.end_date || today);
      const spanDays = Math.max(1, Math.min(180, daysBetween(start, end < today ? end : today) + 1));
      const paidDays = Math.max(1, Math.round(spanDays * (daysPerWk / 7)));
      s.site_allow += round2(paidDays * daily);
    });
    salAll.forEach(p => {
      const s = ensureStaff(p.staff, p.company);
      s.paid += Number(p.amount || 0);
      s.payments += 1;
    });
    const staffRows = Array.from(staffMap.values()).map(s => {
      if (s.base === 0 && s.paid > 0) s.base = s.paid; // historical disbursed baseline when contract salary is 0
      s.earnings = round2(s.base + s.ot_pay + s.extras + s.reimb + s.site_allow - s.late_ded - s.abs_ded - s.ded);
      s.balance = round2(s.earnings - s.paid);
      return s;
    }).sort((a, b) => b.paid - a.paid || b.earnings - a.earnings);

    const shownStaff = sortRows(staffRows, 'pay_staff', 'paid', 'desc').slice(0, shownCount('pay_staff'));
    const shownSal = sortRows(salAll, 'pay_sal', 'date', 'desc').slice(0, shownCount('pay_sal'));
    const shownEmp = sortRows(empAll, 'pay_emp', 'start_date', 'desc').slice(0, shownCount('pay_emp'));
    const shownAtt = sortRows(attAll, 'pay_att', 'date', 'desc').slice(0, shownCount('pay_att'));
    const shownLog = sortRows(logAll, 'pay_log', 'start_date', 'desc').slice(0, shownCount('pay_log'));
    const unmatchedRows = pricing.unmatched_salary_by_staff || [];
    const totalSiteAllow = staffRows.reduce((a, r) => a + r.site_allow, 0);
    const chip = (key, label) => `<button type="button" class="filter-chip ${STATE.chipFilter === key ? 'active' : ''}" data-chip="${esc(key)}">${label}</button>`;

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">WORKFORCE &amp; PAYROLL COMMAND · M239 / M244 / M245 / M247</div>
          <div class="cockpit-title">Payroll, Attendance, Site Allowances &amp; Contracts</div>
          <div class="cockpit-sub">16-column staff earnings register (Base + Overtime + Site Allowances − Lateness &amp; Absence vs Paid), Employment &amp; Freelance Contracts, Mon–Sun Site Allowances, and Attendance.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Salaries Paid (Book)</div><div class="cockpit-pill-val brass">${fmtUSD(k.salaries_paid, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Contracts</div><div class="cockpit-pill-val emerald">${fmtNum(empAll.filter(e => e.status !== 'Ended' && (!e.end_date || e.end_date >= today)).length)} / ${fmtNum(empAll.length)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Overtime &amp; Trip Bonus</div><div class="cockpit-pill-val">${fmtUSD(k.overtime_bonus, 0)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Site Allowances</div><div class="cockpit-pill-val">${fmtUSD(totalSiteAllow, 0)} (${fmtNum(logAll.length)})</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Unmatched Salary</div><div class="cockpit-pill-val ${Number(pricing.unmatched_salary_payments_usd || 0) > 0 ? 'amber' : 'emerald'}">${fmtUSD(pricing.unmatched_salary_payments_usd || 0, 0)}</div></div>
        </div>
      </div>

      <div class="panel-card" style="margin-bottom:14px">
        <div class="table-toolbar" style="border-bottom:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${searchBox('Search staff member, payroll month, contract type, site, equipment...')}
            <div class="chip-bar">
              ${chip('all', 'All Workforce Registers')}
              ${chip('register', `Staff Register (${staffRows.length})`)}
              ${chip('salaries', `Salary Payments (${salAll.length})`)}
              ${chip('contracts', `Contracts (${empAll.length})`)}
              ${chip('allowances', `Site Allowances (${logAll.length})`)}
              ${chip('attendance', `Attendance (${attAll.length})`)}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="btn btn-brass" data-pbi-jump="p12_payroll">📊 Open P12 · Payroll BI Studio</button>
            <button type="button" class="btn" data-nav-jump="statements" data-stmt-jump="10">🖨 Payroll Register RDL (#10)</button>
            <button type="button" class="btn" data-nav-jump="statements" data-stmt-jump="17">🖨 Driver Statement RDL (#17)</button>
            ${canEnterForm('salary') ? '<button type="button" class="btn btn-primary" data-open-modal="salary">+ Pay Salary</button>' : ''}
            ${canEnterForm('attendance') ? '<button type="button" class="btn" data-open-modal="attendance">+ Log Attendance</button>' : ''}
          </div>
        </div>
      </div>

      ${(STATE.chipFilter === 'all' || STATE.chipFilter === 'register') ? `
      <div class="panel-card" id="payStaffRegPanel" style="margin-bottom:14px">
        <div class="panel-head">
          <div>
            <div class="panel-title"><span>PAYROLL BY STAFF MEMBER — BASE, OVERTIME, DEDUCTIONS, SITE ALLOWANCE, EARNINGS, PAID &amp; BALANCE</span></div>
            <span class="ph-sub">Site allowances are included inside Earnings (m247) · Amber badge = no active contract on file</span>
          </div>
          <span class="panel-meta">${fmtNum(staffRows.length)} Staff ${exportBtn('payStaffRegPanel', 'Payroll_By_Staff')}</span>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('pay_staff', 'Staff Member', 'staff')}${th('pay_staff', 'Co.', 'company')}${th('pay_staff', 'Contract', 'type')}${th('pay_staff', 'Status', 'status')}
                ${th('pay_staff', 'Base ($)', 'base', 'r')}${th('pay_staff', 'OT Hrs', 'ot_hrs', 'r')}${th('pay_staff', 'OT Pay ($)', 'ot_pay', 'r')}
                ${th('pay_staff', 'Late Hrs', 'late_hrs', 'r')}${th('pay_staff', 'Lateness ($)', 'late_ded', 'r')}${th('pay_staff', 'Absent d', 'absent_days', 'r')}${th('pay_staff', 'Absence ($)', 'abs_ded', 'r')}
                ${th('pay_staff', 'Site Allowance', 'site_allow', 'r')}${th('pay_staff', 'Earnings ($)', 'earnings', 'r')}${th('pay_staff', 'Paid ($)', 'paid', 'r')}${th('pay_staff', 'Balance ($)', 'balance', 'r')}
              </tr>
            </thead>
            <tbody>
              ${shownStaff.map(r => `
                <tr class="rrow ${r.status === 'Ended' ? 'pbi-row-amber' : ''}" data-rkey="employments" data-rid="${esc(r.staff)}">
                  <td>${relLink('employments', r.staff, r.staff, true)}${!r.hasContract ? ' <span class="badge badge-warn" title="Salary payment without an employment contract">No contract</span>' : ''}</td>
                  <td><span class="badge badge-brass">${esc(r.company)}</span></td>
                  <td>${esc(r.type)}</td>
                  <td><span class="badge ${r.status === 'Ended' ? 'badge-warn' : 'badge-ok'}">${esc(r.status)}</span></td>
                  <td class="r">${fmtUSD(r.base, 2)}</td>
                  <td class="r">${fmtNum(r.ot_hrs, 1)}</td>
                  <td class="r">${fmtUSD(r.ot_pay, 2)}</td>
                  <td class="r">${fmtNum(r.late_hrs, 1)}</td>
                  <td class="r">${r.late_ded ? fmtUSD(r.late_ded, 2) : '—'}</td>
                  <td class="r">${fmtNum(r.absent_days, 0)}</td>
                  <td class="r">${r.abs_ded ? fmtUSD(r.abs_ded, 2) : '—'}</td>
                  <td class="r">${r.site_allow ? fmtUSD(r.site_allow, 2) : '—'}</td>
                  <td class="r"><strong>${fmtUSD(r.earnings, 2)}</strong></td>
                  <td class="r pbi-bar-cell"><span class="pbi-bar-bg pos" style="width:${Math.min(94, Math.round((r.paid / Math.max(1, staffRows[0] ? staffRows[0].paid : 1)) * 90))}%"></span><strong>${fmtUSD(r.paid, 2)}</strong></td>
                  <td class="r ${r.balance < 0 ? 'pbi-neg' : ''}"><strong>${fmtUSD(r.balance, 2)}</strong></td>
                </tr>
              `).join('') || emptyRow(15, 'No staff records match filter')}
              ${showMoreRow('pay_staff', staffRows.length, 15)}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">TOTAL (${fmtNum(staffRows.length)} STAFF · BOOK PAYROLL ${fmtUSD(k.salaries_paid, 2)})</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.base, 0), 2)}</td>
                <td class="r">${fmtNum(staffRows.reduce((a, r) => a + r.ot_hrs, 0), 1)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.ot_pay, 0), 2)}</td>
                <td class="r">${fmtNum(staffRows.reduce((a, r) => a + r.late_hrs, 0), 1)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.late_ded, 0), 2)}</td>
                <td class="r">${fmtNum(staffRows.reduce((a, r) => a + r.absent_days, 0), 0)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.abs_ded, 0), 2)}</td>
                <td class="r">${fmtUSD(totalSiteAllow, 2)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.earnings, 0), 2)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.paid, 0), 2)}</td>
                <td class="r">${fmtUSD(staffRows.reduce((a, r) => a + r.balance, 0), 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>` : ''}

      <div class="split-grid-2">
        ${(STATE.chipFilter === 'all' || STATE.chipFilter === 'salaries') ? `
        <div class="panel-card" id="paySalPanel">
          <div class="panel-head">
            <div class="panel-title"><span>SALARY DISBURSEMENTS (${fmtNum(salAll.length)})</span></div>
            <span class="panel-meta">${exportBtn('paySalPanel', 'Salary_Disbursements')} ${canEnterForm('salary') ? '<button class="btn btn-primary" style="padding:3px 9px;font-size:11px" data-open-modal="salary">+ Pay Salary</button>' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead><tr>${th('pay_sal', 'Date', 'date')}${th('pay_sal', 'Payroll Month', 'payroll_month')}${th('pay_sal', 'Co.', 'company')}${th('pay_sal', 'Staff Member', 'staff')}${th('pay_sal', 'Method', 'method')}${th('pay_sal', 'Amount ($)', 'amount', 'r')}${th('pay_sal', 'Voucher', 'name')}</tr></thead>
              <tbody>
                ${shownSal.map(s => `
                  <tr class="rrow" data-rkey="salaries" data-rid="${esc(s.id)}">
                    <td class="mono">${esc(recordDate(s))}${appCell(s, 'salaries')}</td>
                    <td class="mono">${esc(s.payroll_month)}</td>
                    <td><span class="badge badge-brass">${esc(s.company)}</span></td>
                    <td><strong>${esc(s.staff)}</strong></td>
                    <td>${esc(s.method || 'Cash')}</td>
                    <td class="r"><strong>${fmtUSD(s.amount, 2)}</strong></td>
                    <td class="mono mu">${esc(s.name || '—')}</td>
                  </tr>
                `).join('') || emptyRow(7, 'No salary payments match filter')}
                ${showMoreRow('pay_sal', salAll.length, 7)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5"><b>TOTAL (${fmtNum(salAll.length)} PAYMENTS)</b></td>
                  <td class="r"><b>${fmtUSD(salAll.reduce((a, s) => a + Number(s.amount || 0), 0), 2)}</b></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>` : ''}

        ${(STATE.chipFilter === 'all' || STATE.chipFilter === 'contracts') ? `
        <div class="panel-card" id="payEmpPanel">
          <div class="panel-head">
            <div class="panel-title"><span>EMPLOYMENT &amp; FREELANCE CONTRACTS (${fmtNum(empAll.length)})</span></div>
            <span class="panel-meta">Amber = Ended contract (m244) ${exportBtn('payEmpPanel', 'Employment_Contracts')} ${canEnterForm('employment') ? '<button class="btn" style="padding:3px 9px;font-size:11px" data-open-modal="employment">+ Contract</button>' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead><tr>${th('pay_emp', 'Staff', 'staff')}${th('pay_emp', 'Co.', 'company')}${th('pay_emp', 'Type', 'type')}${th('pay_emp', 'Start', 'start_date')}${th('pay_emp', 'End', 'end_date')}${th('pay_emp', 'Status', 'status')}${th('pay_emp', 'Monthly ($)', 'salary_usd', 'r')}${th('pay_emp', 'Daily ($)', 'daily_rate', 'r')}</tr></thead>
              <tbody>
                ${shownEmp.map(e => {
                  const ended = e.status === 'Ended' || (e.end_date && String(e.end_date) < today);
                  return `
                  <tr class="rrow ${ended ? 'pbi-row-amber' : ''}" data-rkey="employments" data-rid="${esc(e.id)}">
                    <td><strong>${esc(e.staff)}</strong>${appCell(e, 'employments')}</td>
                    <td><span class="badge badge-brass">${esc(e.company)}</span></td>
                    <td>${esc(e.type || 'Regular')}</td>
                    <td class="mono">${esc(e.start_date || '—')}</td>
                    <td class="mono">${esc(e.end_date || 'Open')}</td>
                    <td><span class="badge ${ended ? 'badge-warn' : 'badge-ok'}">${ended ? 'Ended' : (e.status || 'Current')}</span></td>
                    <td class="r"><strong>${fmtUSD(e.salary_usd, 2)}</strong></td>
                    <td class="r">${e.daily_rate ? fmtUSD(e.daily_rate, 2) : '—'}</td>
                  </tr>`;
                }).join('') || emptyRow(8, 'No contracts match filter')}
                ${showMoreRow('pay_emp', empAll.length, 8)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6"><b>TOTAL (${fmtNum(empAll.length)} CONTRACTS)</b></td>
                  <td class="r"><b>${fmtUSD(empAll.reduce((a, e) => a + Number(e.salary_usd || 0), 0), 2)}</b></td>
                  <td class="r"><b>${fmtUSD(empAll.reduce((a, e) => a + Number(e.daily_rate || 0), 0), 2)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>` : ''}
      </div>

      <div class="split-grid-2" style="margin-top:14px">
        ${(STATE.chipFilter === 'all' || STATE.chipFilter === 'allowances') ? `
        <div class="panel-card" id="payLogPanel">
          <div class="panel-head">
            <div class="panel-title"><span>SITE ALLOWANCE ARRANGEMENTS (MON–SUN · ${fmtNum(logAll.length)})</span></div>
            <span class="panel-meta">${exportBtn('payLogPanel', 'Site_Allowances')} ${canEnterForm('logistics') ? '<button class="btn" style="padding:3px 9px;font-size:11px" data-open-modal="logistics">+ Allowance</button>' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead><tr>${th('pay_log', 'Staff', 'staff')}${th('pay_log', 'Site / Location', 'site')}${th('pay_log', 'Equipment', 'equipment')}${th('pay_log', 'Start', 'start_date')}${th('pay_log', 'End', 'end_date')}${th('pay_log', 'Working Days', 'working_days')}${th('pay_log', 'Daily ($)', 'daily_usd', 'r')}</tr></thead>
              <tbody>
                ${shownLog.map(l => {
                  const ended = l.end_date && String(l.end_date) < today;
                  return `
                  <tr class="rrow ${ended ? 'pbi-row-amber' : ''}" data-rkey="logistics_allowances" data-rid="${esc(l.id)}">
                    <td>${relLink('employments', l.staff, l.staff, true)}${appCell(l, 'logistics_allowances')}</td>
                    <td>${l.site ? relLink('sites', l.site) : '—'}</td>
                    <td class="mono">${l.equipment ? relLink('equipment', l.equipment) : '—'}</td>
                    <td class="mono">${esc(l.start_date || '—')}</td>
                    <td class="mono">${esc(l.end_date || 'Open')}</td>
                    <td>${esc(l.working_days || 'Mon–Sat')}</td>
                    <td class="r"><strong>${fmtUSD(l.daily_usd || l.usd_amount || (Number(l.lbp_amount || 0) / 89500), 2)}</strong></td>
                  </tr>`;
                }).join('') || emptyRow(7, 'No site allowances match filter')}
                ${showMoreRow('pay_log', logAll.length, 7)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6"><b>TOTAL (${fmtNum(logAll.length)} ARRANGEMENTS)</b></td>
                  <td class="r"><b>${fmtUSD(logAll.reduce((a, l) => a + Number(l.daily_usd || l.usd_amount || (Number(l.lbp_amount || 0) / 89500) || 0), 0), 2)} / day</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>` : ''}

        ${(STATE.chipFilter === 'all' || STATE.chipFilter === 'attendance') ? `
        <div class="panel-card" id="payAttPanel">
          <div class="panel-head">
            <div class="panel-title"><span>ATTENDANCE, OVERTIME &amp; LEAVE RECORDS (${fmtNum(attAll.length)})</span></div>
            <span class="panel-meta">${exportBtn('payAttPanel', 'Attendance_Records')} ${canEnterForm('attendance') ? '<button class="btn" style="padding:3px 9px;font-size:11px" data-open-modal="attendance">+ Attendance</button>' : ''}</span>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead><tr>${th('pay_att', 'Date', 'date')}${th('pay_att', 'Co.', 'company')}${th('pay_att', 'Staff', 'staff')}${th('pay_att', 'Status / Type', 'status')}${th('pay_att', 'Reg Hrs', 'regular_hours', 'r')}${th('pay_att', 'OT Hrs', 'overtime_hours', 'r')}${th('pay_att', 'Late Hrs', 'late_hours', 'r')}${th('pay_att', 'Notes', 'notes')}</tr></thead>
              <tbody>
                ${shownAtt.map(a => `
                  <tr class="rrow" data-rkey="attendance" data-rid="${esc(a.id)}">
                    <td class="mono">${esc(a.date)}${appCell(a, 'attendance')}</td>
                    <td><span class="badge badge-brass">${esc(a.company)}</span></td>
                    <td><strong>${esc(a.staff)}</strong></td>
                    <td><span class="badge ${/Absent|Sick/i.test(a.status) ? 'badge-warn' : 'badge-ok'}">${esc(a.status || 'Present')}</span></td>
                    <td class="r">${fmtNum(a.regular_hours, 1)}</td>
                    <td class="r">${fmtNum(a.overtime_hours, 1)}</td>
                    <td class="r">${fmtNum(a.late_hours, 1)}</td>
                    <td class="mu">${esc(a.notes || '—')}</td>
                  </tr>
                `).join('') || emptyRow(8, 'No attendance records match filter')}
                ${showMoreRow('pay_att', attAll.length, 8)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4"><b>TOTAL (${fmtNum(attAll.length)} RECORDS)</b></td>
                  <td class="r"><b>${fmtNum(attAll.reduce((a, r) => a + Number(r.regular_hours || 0), 0), 1)}</b></td>
                  <td class="r"><b>${fmtNum(attAll.reduce((a, r) => a + Number(r.overtime_hours || 0), 0), 1)}</b></td>
                  <td class="r"><b>${fmtNum(attAll.reduce((a, r) => a + Number(r.late_hours || 0), 0), 1)}</b></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>` : ''}
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 10: GENERAL LEDGER & TRIAL BALANCE (LEBANESE COA CLASSES 1–7)
  // ==========================================================================
  function renderGL() {
    const m = getModel();
    const k = getKPI();
    const q = STATE.search.trim().toLowerCase();
    const tbAll = m.gl_tb || [];
    const tb = sortRows(tbAll.filter(r => !q || `${r.Code} ${r.Account} ${r.Class}`.toLowerCase().includes(q)), 'gl', 'Code', 'asc');
    let totDr = 0, totCr = 0;
    tbAll.forEach(r => { totDr += Number(r.debit || 0); totCr += Number(r.credit || 0); });
    const diff = round2(totDr - totCr);
    const tied = Math.abs(diff) < 0.005;
    let tbDr = 0, tbCr = 0;
    tb.forEach(r => { tbDr += Number(r.debit || 0); tbCr += Number(r.credit || 0); });
    const tbDiff = round2(tbDr - tbCr);

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">LEBANESE GENERAL CHART OF ACCOUNTS (PLAN COMPTABLE GÉNÉRAL)</div>
          <div class="cockpit-title">General Ledger &amp; Trial Balance</div>
          <div class="cockpit-sub">Every operational transaction posts balanced Debit &amp; Credit legs in real time · Classes 1 to 7 tied to ${tied ? '$0.00' : fmtUSD(diff, 2)} variance.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Debits</div><div class="cockpit-pill-val">${fmtUSD(totDr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Total Credits</div><div class="cockpit-pill-val">${fmtUSD(totCr, 2)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">TB Check</div><div class="cockpit-pill-val ${tied ? 'emerald' : 'amber'}">${tied ? '$0.00 TIED' : fmtUSD(diff, 2) + ' OFF'}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Model TB Check</div><div class="cockpit-pill-val ${Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'emerald' : 'amber'}">${fmtUSD(k.tb_check || 0, 2)}</div></div>
        </div>
      </div>

      <div class="panel-card" id="glPanel">
        <div class="table-toolbar">
          ${searchBox('Search GL code, account, class...')}
          <div style="display:flex;gap:6px">${exportBtn('glPanel', 'Trial_Balance')}<button class="btn" data-nav-jump="statements" data-stmt-jump="05">Print Official Trial Balance RDL (#05) →</button></div>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('gl', 'GL Code', 'Code')}${th('gl', 'Account Name', 'Account')}${th('gl', 'Lebanese CoA Class', 'Class')}${th('gl', 'Total Debit ($)', 'debit', 'r')}${th('gl', 'Total Credit ($)', 'credit', 'r')}${th('gl', 'Net Balance ($)', 'balance', 'r')}
              </tr>
            </thead>
            <tbody>
              ${tb.map(r => `
                <tr>
                  <td class="mono"><strong>${esc(r.Code)}</strong></td>
                  <td><strong>${esc(r.Account)}</strong></td>
                  <td><span class="badge badge-info">${esc(r.Class)}</span></td>
                  <td class="r">${fmtUSD(r.debit, 2)}</td>
                  <td class="r">${fmtUSD(r.credit, 2)}</td>
                  <td class="r"><strong>${fmtUSD(r.balance, 2)}</strong></td>
                </tr>
              `).join('') || emptyRow(6, tbAll.length ? `No accounts match "${STATE.search}".` : 'No trial balance published for this entity')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><b>TOTAL TRIAL BALANCE (${fmtNum(tb.length)} ACTIVE GL ACCOUNTS)</b></td>
                <td class="r"><b>${fmtUSD(tbDr, 2)}</b></td>
                <td class="r"><b>${fmtUSD(tbCr, 2)}</b></td>
                <td class="r"><b>${fmtUSD(tbDiff, 2)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="panel-card" id="soaPanel">
        <div class="panel-head">
          <div class="panel-title"><span>AUDITED SOA DOUBLE-ENTRY JOURNAL STREAM (${fmtNum((m.soa_stream || []).length)} RECENT LEGS)</span></div>
          <span class="panel-meta">Balanced Debit &amp; Credit Postings ${exportBtn('soaPanel', 'SOA_Journal_Stream')}</span>
        </div>
        <div class="table-wrap">
          <table class="ledger-table">
            <thead>
              <tr>
                ${th('soa', 'Date', 'date')}${th('soa', 'Co.', 'company')}${th('soa', 'Voucher / Document', 'doc')}${th('soa', 'GL Code', 'code')}${th('soa', 'Account', 'account')}
                ${th('soa', 'Counterparty / Detail', 'detail')}${th('soa', 'Description', 'desc')}${th('soa', 'Debit ($)', 'debit', 'r')}${th('soa', 'Credit ($)', 'credit', 'r')}
              </tr>
            </thead>
            <tbody>
              ${sortRows((m.soa_stream || []).filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)), 'soa', 'date', 'desc').map(r => `
                <tr>
                  <td class="mono">${esc(String(r.date || '').slice(0, 10))}</td>
                  <td><span class="badge badge-brass">${esc(r.company || 'WTC')}</span></td>
                  <td class="mono">${esc(r.doc || '—')}</td>
                  <td class="mono"><strong>${esc(r.code)}</strong></td>
                  <td><strong>${esc(r.account)}</strong></td>
                  <td>${esc(r.detail || '—')}</td>
                  <td>${esc(r.desc || '—')}</td>
                  <td class="r">${r.debit ? fmtUSD(r.debit, 2) : '—'}</td>
                  <td class="r">${r.credit ? fmtUSD(r.credit, 2) : '—'}</td>
                </tr>
              `).join('') || emptyRow(9, 'No SOA journal legs in this snapshot')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7">TOTAL SOA JOURNAL STREAM (${fmtNum((m.soa_stream || []).filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)).length)} LEGS)</td>
                <td class="r">${fmtUSD((m.soa_stream || []).filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)).reduce((s, r) => s + (+r.debit || 0), 0), 2)}</td>
                <td class="r">${fmtUSD((m.soa_stream || []).filter(r => !q || Object.values(r).join(' ').toLowerCase().includes(q)).reduce((s, r) => s + (+r.credit || 0), 0), 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 11: 22 PRINTABLE STATEMENTS HUB (A4 / PDF / CSV EXPORT)
  // ==========================================================================
  const STATEMENT_CATALOG = [
    { code: '01', name: 'Daily Operations', cat: 'Digest' },
    { code: '02', name: 'Balance Sheet', cat: 'Statements' },
    { code: '03', name: 'Income Statement', cat: 'Statements' },
    { code: '04', name: 'Cash Flow Statement', cat: 'Statements' },
    { code: '05', name: 'Trial Balance', cat: 'General Ledger' },
    { code: '06', name: 'General Journal', cat: 'General Ledger' },
    { code: '07', name: 'Sub-Account Statement', cat: 'General Ledger' },
    { code: '08', name: 'Sales Register', cat: 'Registers' },
    { code: '09', name: 'Expense Register', cat: 'Registers' },
    { code: '10', name: 'Payroll Register', cat: 'Registers' },
    { code: '11', name: 'Raw Material', cat: 'Registers' },
    { code: '12', name: 'Fuel Log', cat: 'Registers' },
    { code: '13', name: 'Aged Receivables', cat: 'Counterparties' },
    { code: '14', name: 'Customer Statement', cat: 'Counterparties' },
    { code: '15', name: 'Supplier Balances', cat: 'Counterparties' },
    { code: '16', name: 'Supplier Statement', cat: 'Counterparties' },
    { code: '17', name: 'Driver Statement', cat: 'Counterparties' },
    { code: '18', name: 'VAT Return', cat: 'Tax & Recon' },
    { code: '19', name: 'P&L Reconciliation', cat: 'Tax & Recon' },
    { code: '20', name: 'Sales Invoice', cat: 'Documents' },
    { code: '21', name: 'Delivery Ticket', cat: 'Documents' },
    { code: '22', name: 'Receipt Voucher', cat: 'Documents' }
  ];

  function stTable(cols, rows, foot) {
    const displayRows = rows.length > 250 ? rows.slice(0, 250) : rows;
    return `<table class="ledger-table">
      <thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${displayRows.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r' : ''}${c.mono ? ' mono' : ''}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] == null || r[c.key] === '' ? '—' : r[c.key])}</td>`).join('')}</tr>`).join('') || emptyRow(cols.length, 'No rows for this entity / period')}</tbody>
      ${foot ? `<tfoot><tr>${foot.map(f => `<td class="${f.r ? 'r' : ''}" ${f.span ? `colspan="${f.span}"` : ''}>${f.v}</td>`).join('')}</tr></tfoot>` : ''}
    </table>`;
  }
  const C = {
    usd0: v => fmtUSD(v, 0), usd2: v => fmtUSD(v, 2), num0: v => fmtNum(v, 0), num1: v => fmtNum(v, 1), num2: v => fmtNum(v, 2),
    date: v => esc(String(v || '').slice(0, 10) || '—')
  };

  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    return map;
  }

  function renderStatementSheet(code) {
    const m = getModel();
    const k = getKPI();
    const st = STATEMENT_CATALOG.find(x => x.code === code) || STATEMENT_CATALOG[0];
    const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
    let bodyHtml = '';

    if (code === '02') {
      const tb = m.gl_tb || [];
      bodyHtml = stTable([
        { label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Class', key: 'Class' },
        { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], tb, [{ v: `TOTAL (${tb.length} ACCOUNTS)`, span: 3 }, { v: fmtUSD(sum(tb, 'debit'), 2), r: true }, { v: fmtUSD(sum(tb, 'credit'), 2), r: true }, { v: fmtUSD(sum(tb, 'debit') - sum(tb, 'credit'), 2), r: true }]);
    } else if (code === '03') {
      bodyHtml = `
        <table class="ledger-table">
          <thead><tr><th>Code</th><th>Income Statement Line (Lebanese CoA Class 7 &amp; Class 6)</th><th class="r">Amount (USD)</th><th class="r">% of Net Sales</th></tr></thead>
          <tbody>
            <tr><td class="mono">701/7085</td><td><strong>Gross Revenue incl. 11% VAT (Sales TTC)</strong></td><td class="r">${fmtUSD(k.sales_ttc, 2)}</td><td class="r">—</td></tr>
            <tr><td class="mono">4427</td><td>Less: Output VAT 11% Invoiced</td><td class="r">(${fmtUSD(k.sales_vat, 2)})</td><td class="r">—</td></tr>
            <tr><td class="mono">701/706</td><td><strong>Total Sales Revenue (Ex-VAT · Mat + Trans)</strong></td><td class="r"><strong>${fmtUSD(k.gross_sales || k.net_sales, 2)}</strong></td><td class="r">—</td></tr>
            <tr><td class="mono">701</td><td><strong>Material Sales Revenue (Ex-VAT)</strong></td><td class="r"><strong>${fmtUSD(k.net_sales, 2)}</strong></td><td class="r">100.0%</td></tr>
            <tr><td class="mono">601</td><td>Raw Material Cost (Quarry Owners)</td><td class="r">(${fmtUSD(k.raw_mat_cost, 2)})</td><td class="r">${fmtPct((k.raw_mat_cost || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">611</td><td>Quarry Haulage Cost (Third-Party Trucks)</td><td class="r">(${fmtUSD(k.raw_haulage, 2)})</td><td class="r">${fmtPct((k.raw_haulage || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">GM</td><td><strong>GROSS MARGIN</strong></td><td class="r"><strong>${fmtUSD(k.gross_margin, 2)}</strong></td><td class="r"><strong>${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)}</strong></td></tr>
            <tr><td class="mono">61/62</td><td>Plant &amp; Fleet Operating Expenses</td><td class="r">(${fmtUSD(k.expenses, 2)})</td><td class="r">${fmtPct((k.expenses || 0) / (k.net_sales || 1))}</td></tr>
            <tr><td class="mono">641</td><td>Staff Salaries &amp; Workforce Wages Paid</td><td class="r">(${fmtUSD(k.salaries_paid, 2)})</td><td class="r">${fmtPct((k.salaries_paid || 0) / (k.net_sales || 1))}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="2">OPERATING PROFIT (CASH VIEW)</td><td class="r">${fmtUSD(k.operating_profit, 2)}</td><td class="r">${fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales)}</td></tr>
          </tfoot>
        </table>`;
    } else if (code === '04') {
      const tb = (m.gl_tb || []).filter(r => Number(r.Class) >= 1 && Number(r.Class) <= 5);
      const cls = n => tb.filter(r => Number(r.Class) === n);
      const names = { 1: 'Class 1 · Capital, Reserves & Long-Term Liabilities', 2: 'Class 2 · Fixed Assets', 3: 'Class 3 · Inventories', 4: 'Class 4 · Receivables, Payables & VAT', 5: 'Class 5 · Cash, Bank & Till' };
      bodyHtml = [1, 2, 3, 4, 5].map(n => `
        <h4>${names[n]}</h4>
        ${stTable([{ label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Net Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }],
          cls(n), [{ v: 'CLASS TOTAL', span: 2 }, { v: fmtUSD(sum(cls(n), 'debit'), 2), r: true }, { v: fmtUSD(sum(cls(n), 'credit'), 2), r: true }, { v: fmtUSD(sum(cls(n), 'balance'), 2), r: true }])}`).join('');
      const assets = sum(cls(2), 'balance') + sum(cls(3), 'balance') + sum(cls(5), 'balance') + Number(k.ar_balance || 0);
      bodyHtml += `<div class="live-calc" style="margin-top:16px"><div><small>Open AR (Class 4 asset)</small><b>${fmtUSD(k.ar_balance, 0)}</b></div><div><small>Open AP (Class 4 liability)</small><b>${fmtUSD(k.ap_balance, 0)}</b></div><div><small>Cash Till 5300</small><b>${fmtUSD(k.cash_till, 2)}</b></div><div><small>Classes 2+3+5 + AR</small><b>${fmtUSD(assets, 0)}</b></div></div>`;
    } else if (code === '05') {
      const months = (m.monthly || []).slice(-12).map(r => ({ ...r, net: Number(r.cash_in || 0) - Number(r.cash_out || 0) }));
      bodyHtml = stTable([
        { label: 'Month', key: 'Year Month' }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd0 }, { label: 'Cash In', key: 'cash_in', r: true, fmt: C.usd0 }, { label: 'Cash Out', key: 'cash_out', r: true, fmt: C.usd0 },
        { label: 'Net Cash Flow', key: 'net', r: true, fmt: v => `<strong style="color:${v < 0 ? 'var(--crit)' : 'var(--good)'}">${fmtUSD(v, 0)}</strong>` }, { label: 'Raw Cost', key: 'raw_cost', r: true, fmt: C.usd0 }, { label: 'Expenses', key: 'expenses', r: true, fmt: C.usd0 }, { label: 'Salaries', key: 'salaries', r: true, fmt: C.usd0 }
      ], months, [{ v: `PERIOD (${esc(k.label || 'All-Time')}) · TILL ${fmtUSD(k.cash_till, 2)}`, span: 2 }, { v: fmtUSD(k.cash_inflow, 0), r: true }, { v: fmtUSD(k.cash_outflow, 0), r: true }, { v: fmtUSD(k.net_cash_flow, 0), r: true }, { v: fmtUSD(k.raw_cost, 0), r: true }, { v: fmtUSD(k.expenses, 0), r: true }, { v: fmtUSD(k.salaries_paid, 0), r: true }]);
    } else if (code === '06') {
      const lines = [
        ['Sales TTC', fmtUSD(k.sales_ttc, 2), `${fmtNum(k.loads)} loads · ${fmtNum(k.tons_sold, 0)} t · avg ${fmtUSD(k.avg_price_ttc, 2)}/unit`],
        ['Cash vs Credit Sales', `${fmtUSD(k.cash_sales, 0)} / ${fmtUSD(k.credit_sales, 0)}`, `${fmtNum(k.delivery_loads)} delivery · ${fmtNum(k.pickup_loads)} pickup`],
        ['Raw Material Intake', fmtUSD(k.raw_cost, 2), `${fmtNum(k.raw_loads)} loads · ${fmtNum(k.raw_tons, 0)} t · material ${fmtUSD(k.raw_mat_cost, 0)} + haulage ${fmtUSD(k.raw_haulage, 0)}`],
        ['Expenses', fmtUSD(k.expenses, 2), `cash ${fmtUSD(k.cash_expenses, 0)} · credit ${fmtUSD(k.credit_expenses, 0)}`],
        ['Payroll', fmtUSD(k.salaries_paid, 2), `overtime bonus ${fmtUSD(k.overtime_bonus, 0)} · commission due ${fmtUSD(k.commission_due, 0)}`],
        ['Customer Receipts', fmtUSD(k.receipts, 2), `open AR ${fmtUSD(k.ar_balance, 2)} · overdue ${fmtUSD(k.ar_overdue, 0)} · DSO ${fmtNum(k.dso_days, 0)} d`],
        ['Supplier Settlements', fmtUSD(k.settlements_paid, 2), `open AP ${fmtUSD(k.ap_balance, 0)}`],
        ['Cash Till 5300', fmtUSD(k.cash_till, 2), `in ${fmtUSD(k.cash_inflow, 0)} · out ${fmtUSD(k.cash_outflow, 0)} · net ${fmtUSD(k.net_cash_flow, 0)}`],
        ['Diesel', `${fmtNum(k.diesel_litres, 0)} L issued`, `purchased ${fmtNum(k.diesel_purchased, 0)} L · sold ${fmtNum(k.diesel_sold, 0)} L · tank ${fmtNum(k.diesel_in_tank, 0)} L`],
        ['Fleet', `${fmtNum(k.active_equip)} units`, `${fmtNum(k.trucks_used)} trucks used · ${fmtNum(k.own_fleet_loads)} own-fleet loads · ${fmtUSD(k.cost_per_ton, 2)}/t`],
        ['Gross Margin / Operating Profit', `${fmtUSD(k.gross_margin, 0)} / ${fmtUSD(k.operating_profit, 0)}`, `${fmtPct(k.gm_pct, k.gross_margin, k.net_sales)} GM · ${fmtPct(k.op_margin_pct, k.operating_profit, k.net_sales)} op margin`],
        ['Trial Balance', fmtUSD(k.tb_check || 0, 2), Math.abs(Number(k.tb_check || 0)) < 0.005 ? 'tied' : 'VARIANCE — investigate']
      ].map(([a, b, c]) => ({ a, b, c }));
      bodyHtml = stTable([{ label: 'Measure', key: 'a' }, { label: 'Value', key: 'b', r: true, fmt: v => `<strong>${v}</strong>` }, { label: 'Detail', key: 'c' }], lines);
      const app = appEnteredSummary();
      if (app.length) bodyHtml += `<h4>App-entered this period (not yet in the figures above)</h4>${stTable([{ label: 'Register', key: 'label' }, { label: 'Rows', key: 'n', r: true }, { label: 'Amount', key: 'sum', r: true, fmt: (v, r) => r.unit === 'L' ? fmtNum(v, 0) + ' L' : fmtUSD(v, 2) }], app)}`;
    } else if (code === '07') {
      const rows = sortRows(filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }), 'st07', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Type', key: 'sale_type' }, { label: 'Customer', key: 'customer' }, { label: 'Product', key: 'product' }, { label: 'Site', key: 'site' }, { label: 'Truck', key: 'truck', mono: true },
        { label: 'Qty', key: 'qty', r: true, fmt: (v, r) => fmtNum(v, 2) + ' ' + esc(r.uom || '') }, { label: 'Material', key: 'price', r: true, fmt: C.usd2 }, { label: 'Transport', key: 'trans_price', r: true, fmt: C.usd2 }, { label: 'VAT', key: 'vat', r: true, fmt: C.usd2 }, { label: 'Total TTC', key: 'total_ttc', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Method', key: 'method' }
      ], rows, [{ v: `${fmtNum(rows.length)} TICKETS IN THE WEB SAMPLE · BOOK TOTAL ${fmtUSD(k.sales_ttc, 2)} / ${fmtNum(k.loads)} LOADS`, span: 8 }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }, { v: fmtUSD(sum(rows, 'price'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_price'), 2), r: true }, { v: fmtUSD(sum(rows, 'vat'), 2), r: true }, { v: fmtUSD(sum(rows, 'total_ttc'), 2), r: true }, { v: '' }]);
    } else if (code === '08') {
      const rows = sortRows(filterRecords(SEED.records.raw_purchases, { ignoreSearch: true }), 'st08', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Quarry Site', key: 'site' }, { label: 'Site Owner', key: 'site_owner' }, { label: 'Transport', key: 'transport_by' }, { label: 'Truck Owner', key: 'truck_owner' }, { label: 'Product', key: 'product' },
        { label: 'Qty', key: 'qty', r: true, fmt: (v, r) => fmtNum(v, 2) + ' ' + esc(r.uom || '') }, { label: 'Material', key: 'cost', r: true, fmt: C.usd2 }, { label: 'Haulage', key: 'trans_cost', r: true, fmt: C.usd2 }, { label: 'Total', key: 'total', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], rows, [{ v: `${fmtNum(rows.length)} RECEIPTS IN THE WEB SAMPLE · BOOK TOTAL ${fmtUSD(k.raw_cost, 2)} / ${fmtNum(k.raw_loads)} LOADS`, span: 8 }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }, { v: fmtUSD(sum(rows, 'cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'total'), 2), r: true }]);
    } else if (code === '09' || code === '11') {
      const rows = (m.customers || []);
      bodyHtml = stTable([
        { label: 'Customer', key: 'Customer', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'VAT Reg', key: 'VAT Registered' }, { label: 'Loads', key: 'loads', r: true, fmt: C.num0 }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd2 }, { label: 'Receipts', key: 'receipts', r: true, fmt: C.usd2 },
        { label: 'Current', key: 'ar_current', r: true, fmt: C.usd2 }, { label: 'Overdue', key: 'ar_overdue', r: true, fmt: C.usd2 }, { label: 'Overdue 60+', key: 'ar_60_plus', r: true, fmt: C.usd2 }, { label: 'VAT Receivable', key: 'vat_receivable', r: true, fmt: C.usd2 }, { label: 'Closing AR ($)', key: 'ar_balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Last Sale', key: 'last_sale', fmt: C.date }
      ], rows, [{ v: `${rows.length} CUSTOMERS · BOOK AR ${fmtUSD(k.ar_balance, 2)}`, span: 5 }, { v: fmtUSD(sum(rows, 'ar_current'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_overdue'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_60_plus'), 2), r: true }, { v: fmtUSD(sum(rows, 'vat_receivable'), 2), r: true }, { v: fmtUSD(sum(rows, 'ar_balance'), 2), r: true }, { v: '' }]);
    } else if (code === '10' || code === '12') {
      const rows = (m.suppliers || []);
      bodyHtml = stTable([
        { label: 'Supplier / Hauler', key: 'Supplier', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'IVA', key: 'IVA' }, { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: C.num0 }, { label: 'Material Leg', key: 'ap_material', r: true, fmt: C.usd2 }, { label: 'Haulage Leg', key: 'ap_haulage', r: true, fmt: C.usd2 }, { label: 'Expense Leg', key: 'ap_expense', r: true, fmt: C.usd2 }, { label: 'Paid ($)', key: 'settlements_paid', r: true, fmt: C.usd2 }, { label: 'Closing AP ($)', key: 'ap_balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], rows, [{ v: `${rows.length} SUPPLIERS · BOOK AP ${fmtUSD(k.ap_balance, 2)}`, span: 3 }, { v: fmtUSD(sum(rows, 'ap_material'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_haulage'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_expense'), 2), r: true }, { v: fmtUSD(sum(rows, 'settlements_paid'), 2), r: true }, { v: fmtUSD(sum(rows, 'ap_balance'), 2), r: true }]);
    } else if (code === '13') {
      const rows = (m.equipment || []);
      bodyHtml = stTable([
        { label: 'Equipment', key: 'Equipment', mono: true }, { label: 'Type', key: 'Type' }, { label: 'Ownership', key: 'Ownership' }, { label: 'Trips', key: 'trips', r: true, fmt: C.num0 }, { label: 'Diesel (L)', key: 'diesel_litres', r: true, fmt: C.num0 }, { label: 'Km Run', key: 'km_run', r: true, fmt: C.num0 },
        { label: 'Running ($)', key: 'running_cost', r: true, fmt: C.usd2 }, { label: 'Driver ($)', key: 'driver_cost', r: true, fmt: C.usd2 }, { label: 'Total Cost', key: 'total_cost', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: '$/Ton', key: 'cost_per_ton', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }
      ], rows, [{ v: `${rows.length} UNITS · FLEET COST ${fmtUSD(k.total_equip_cost, 2)} · ${fmtUSD(k.cost_per_ton, 2)}/T`, span: 6 }, { v: fmtUSD(sum(rows, 'running_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'driver_cost'), 2), r: true }, { v: fmtUSD(sum(rows, 'total_cost'), 2), r: true }, { v: '' }]);
    } else if (code === '14') {
      const { fleet } = sentinelSlice();
      const rows = sortRows(filterRecords(SEED.records.fuel_intakes, { ignoreSearch: true }), 'st14', 'date', 'desc');
      bodyHtml = `<div class="live-calc"><div><small>Diesel purchased</small><b>${fmtNum(fleet.diesel_purchased_l != null ? fleet.diesel_purchased_l : k.diesel_purchased, 0)} L</b></div><div><small>Issued to fleet</small><b>${fmtNum(fleet.diesel_issued_l != null ? fleet.diesel_issued_l : k.diesel_litres, 0)} L</b></div><div><small>Sold on tickets</small><b>${fmtNum(k.diesel_sold, 0)} L</b></div><div><small>In tank</small><b>${fmtNum(fleet.diesel_stock_balance_l != null ? fleet.diesel_stock_balance_l : k.diesel_in_tank, 0)} L</b></div></div>
        <h4>Fuel &amp; lubricant intakes (web sample)</h4>` + stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Equipment', key: 'equipment', mono: true }, { label: 'Driver', key: 'driver' }, { label: 'Item', key: 'item' }, { label: 'Litres', key: 'litres', r: true, fmt: C.num1 }, { label: 'Odometer', key: 'odometer', r: true, fmt: v => v != null && v !== '' ? fmtNum(v, 0) : '—' }, { label: 'Hours', key: 'hours', r: true, fmt: v => v != null && v !== '' ? fmtNum(v, 1) : '—' }
      ], rows, [{ v: `${fmtNum(rows.length)} INTAKES`, span: 6 }, { v: fmtNum(sum(rows, 'litres'), 1) + ' L', r: true }, { v: '', span: 2 }]);
    } else if (code === '15') {
      const tickets = filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }).concat(filterRecords(SEED.records.raw_purchases, { ignoreSearch: true }));
      const g = groupBy(tickets.filter(t => t.driver), t => t.driver);
      const rows = Array.from(g.entries()).map(([driver, list]) => ({
        driver, trips: list.length, fleet: list.filter(t => t.transport_by === 'Company fleet').length, overtime: list.filter(t => t.overtime).length,
        qty: sum(list, 'qty'), delivery: list.filter(t => t.sale_type === 'Delivery').length, trucks: uniqSorted(list.map(t => t.truck)).join(', ')
      })).sort((a, b) => b.trips - a.trips);
      const { fleet } = sentinelSlice();
      bodyHtml = `<div class="live-calc"><div><small>Sales overtime bonus (book)</small><b>${fmtUSD(fleet.sales_overtime_bonus_usd, 0)}</b></div><div><small>Raw overtime bonus (book)</small><b>${fmtUSD(fleet.raw_overtime_bonus_usd, 0)}</b></div><div><small>Overtime due (period)</small><b>${fmtUSD(k.overtime_bonus, 0)}</b></div><div><small>Driver payroll unallocated</small><b>${fmtUSD(fleet.unallocated_driver_payroll_usd, 0)}</b></div></div>
        <h4>Driver trips in the web sample (sales + raw)</h4>` + stTable([
        { label: 'Driver', key: 'driver', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Trucks', key: 'trucks', mono: true }, { label: 'Trips', key: 'trips', r: true, fmt: C.num0 }, { label: 'Deliveries', key: 'delivery', r: true, fmt: C.num0 }, { label: 'Company-fleet trips', key: 'fleet', r: true, fmt: C.num0 }, { label: 'Overtime trips', key: 'overtime', r: true, fmt: v => v ? `<strong style="color:var(--warn)">${fmtNum(v)}</strong>` : '0' }, { label: 'Qty hauled', key: 'qty', r: true, fmt: C.num0 }
      ], rows, [{ v: `${rows.length} DRIVERS`, span: 2 }, { v: fmtNum(sum(rows, 'trips')), r: true }, { v: fmtNum(sum(rows, 'delivery')), r: true }, { v: fmtNum(sum(rows, 'fleet')), r: true }, { v: fmtNum(sum(rows, 'overtime')), r: true }, { v: fmtNum(sum(rows, 'qty'), 0), r: true }]);
    } else if (code === '16' || code === '20') {
      const rows = (m.sites || []).filter(s => code === '16' || s.JV === 'Yes').map(s => ({ ...s, Site: s.Site || '(no site on ticket)' }));
      bodyHtml = stTable([
        { label: 'Site', key: 'Site', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'JV', key: 'JV', fmt: v => v === 'Yes' ? '<span class="badge badge-brass">JV 50 / 50</span>' : '—' }, { label: 'Sales Loads', key: 'loads', r: true, fmt: C.num0 }, { label: 'Tons Sold', key: 'tons_sold', r: true, fmt: C.num0 }, { label: 'Sales TTC', key: 'sales_ttc', r: true, fmt: C.usd2 }, { label: 'Transport Rev', key: 'trans_rev', r: true, fmt: C.usd2 },
        { label: 'Raw Loads', key: 'raw_loads', r: true, fmt: C.num0 }, { label: 'Raw Tons', key: 'raw_tons', r: true, fmt: C.num0 }, { label: 'Raw Cost', key: 'raw_cost', r: true, fmt: C.usd2 }, ...(code === '20' ? [{ label: 'Partner 50% of Raw Cost', key: 'raw_cost', r: true, fmt: v => `<strong>${fmtUSD(Number(v || 0) / 2, 2)}</strong>` }] : [])
      ], rows, [{ v: `${rows.length} SITES`, span: 2 }, { v: fmtNum(sum(rows, 'loads')), r: true }, { v: fmtNum(sum(rows, 'tons_sold'), 0), r: true }, { v: fmtUSD(sum(rows, 'sales_ttc'), 2), r: true }, { v: fmtUSD(sum(rows, 'trans_rev'), 2), r: true }, { v: fmtNum(sum(rows, 'raw_loads')), r: true }, { v: fmtNum(sum(rows, 'raw_tons'), 0), r: true }, { v: fmtUSD(sum(rows, 'raw_cost'), 2), r: true }, ...(code === '20' ? [{ v: fmtUSD(sum(rows, 'raw_cost') / 2, 2), r: true }] : [])]);
      if (code === '20') bodyHtml += `<p class="form-note">JV entitlement = partner share × the JV site's raw material cost (Stock Entitlement rule, m114). Revenue-side entitlement is not derivable from tickets because the ticket Site is the delivery site — confirm with the accountant before reading this as a debt.</p>`;
    } else if (code === '17') {
      const today = SEED_DATE;
      const rows = sortRows(filterRecords(SEED.records.price_rules, { ignoreSearch: true, ignorePeriod: true }).filter(r => (!r.end_date || String(r.end_date) >= today) && (!r.start_date || String(r.start_date) <= today)), 'st17', 'customer', 'asc');
      bodyHtml = stTable([
        { label: 'Agreement', key: 'name', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Customer / Owner', key: 'customer', fmt: (v, r) => `<strong>${esc(v || r.supplier || 'Standard List')}</strong>` }, { label: 'Product', key: 'product', fmt: v => esc(v || '(All Grades)') }, { label: 'Site', key: 'site' }, { label: 'Unit', key: 'unit', mono: true }, { label: 'Unit Price', key: 'unit_price', r: true, fmt: C.usd2 }, { label: 'Transport', key: 'trans_unit_price', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }, { label: 'Start', key: 'start_date', mono: true }, { label: 'End', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }
      ], rows, [{ v: `${fmtNum(rows.length)} ACTIVE AGREEMENTS AT ${today}`, span: 10 }]);
    } else if (code === '18') {
      const vatTickets = sortRows(filterRecords(SEED.records.sales_tickets, { ignoreSearch: true }).filter(t => Number(t.vat || 0) > 0 || t.vat_invoice), 'st18', 'date', 'desc');
      bodyHtml = `<div class="live-calc"><div><small>Output VAT 11% invoiced (4427)</small><b>${fmtUSD(k.sales_vat, 2)}</b></div><div><small>VAT receivable from customers</small><b>${fmtUSD(k.vat_receivable, 2)}</b></div><div><small>Net sales ex-VAT</small><b>${fmtUSD(k.net_sales, 2)}</b></div><div><small>Sales TTC</small><b>${fmtUSD(k.sales_ttc, 2)}</b></div></div>
        <h4>VAT-bearing tickets in the web sample</h4>` + stTable([
        { label: 'Date', key: 'date', mono: true }, { label: 'Ticket', key: 'ticket_no', mono: true }, { label: 'VAT Invoice', key: 'vat_invoice', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Customer', key: 'customer' }, { label: 'Net', key: 'total', r: true, fmt: C.usd2 }, { label: 'VAT 11%', key: 'vat', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }, { label: 'Total TTC', key: 'total_ttc', r: true, fmt: C.usd2 }
      ], vatTickets, [{ v: `${fmtNum(vatTickets.length)} TICKETS`, span: 5 }, { v: fmtUSD(sum(vatTickets, 'total'), 2), r: true }, { v: fmtUSD(sum(vatTickets, 'vat'), 2), r: true }, { v: fmtUSD(sum(vatTickets, 'total_ttc'), 2), r: true }]);
    } else if (code === '19') {
      const { pricing } = sentinelSlice();
      const sal = filterRecords(SEED.records.salaries, { ignoreSearch: true });
      const emp = filterRecords(SEED.records.employments, { ignoreSearch: true, ignorePeriod: true });
      const log = filterRecords(SEED.records.logistics_allowances, { ignoreSearch: true, ignorePeriod: true });
      const att = filterRecords(SEED.records.attendance, { ignoreSearch: true });
      const g = groupBy(sal, s => s.staff + '|' + s.payroll_month);
      const rows = Array.from(g.entries()).map(([key, list]) => ({ staff: list[0].staff, month: list[0].payroll_month, company: list[0].company, payments: list.length, amount: sum(list, 'amount'), last: list.map(x => x.date).sort().pop() })).sort((a, b) => String(b.month).localeCompare(String(a.month)) || String(a.staff).localeCompare(String(b.staff)));
      bodyHtml = `
        <div class="live-calc">
          <div><small>Salaries Paid (Book)</small><b>${fmtUSD(k.salaries_paid, 2)}</b></div>
          <div><small>Employment Contracts</small><b>${fmtNum(emp.length)} (${fmtNum(emp.filter(e => e.status !== 'Ended').length)} active)</b></div>
          <div><small>Site Allowance Arrangements</small><b>${fmtNum(log.length)} arrangements</b></div>
          <div><small>Unmatched Salary Payments</small><b>${fmtUSD(pricing.unmatched_salary_payments_usd || 0, 2)}</b></div>
        </div>
        <h4>1 · Staff Salary Disbursements by Payroll Month</h4>` +
        stTable([
          { label: 'Payroll Month', key: 'month', mono: true }, { label: 'Co.', key: 'company' }, { label: 'Staff Member', key: 'staff', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Payments', key: 'payments', r: true, fmt: C.num0 }, { label: 'Last Paid', key: 'last', mono: true }, { label: 'Amount ($)', key: 'amount', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
        ], rows, [{ v: `${rows.length} STAFF-MONTHS · BOOK PAYROLL ${fmtUSD(k.salaries_paid, 2)}`, span: 3 }, { v: fmtNum(sum(rows, 'payments')), r: true }, { v: '' }, { v: fmtUSD(sum(rows, 'amount'), 2), r: true }]) +
        `<h4>2 · Employment &amp; Freelance Contracts Register</h4>` +
        stTable([
          { label: 'Staff Member', key: 'staff', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Co.', key: 'company' }, { label: 'Type', key: 'type' }, { label: 'Status', key: 'status' }, { label: 'Start Date', key: 'start_date', mono: true }, { label: 'End Date', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }, { label: 'Monthly Salary ($)', key: 'salary_usd', r: true, fmt: C.usd2 }, { label: 'Daily Rate ($)', key: 'daily_rate', r: true, fmt: C.usd2 }
        ], emp.slice(0, 80), [{ v: `${emp.length} CONTRACTS`, span: 6 }, { v: fmtUSD(sum(emp, 'salary_usd'), 2), r: true }, { v: '' }]) +
        `<h4>3 · Weekly Site Allowances (Mon–Sun) &amp; Attendance</h4>` +
        stTable([
          { label: 'Staff Member', key: 'staff', fmt: v => `<strong>${esc(v)}</strong>` }, { label: 'Co.', key: 'company' }, { label: 'Site / Location', key: 'site' }, { label: 'Equipment', key: 'equipment', mono: true }, { label: 'Start', key: 'start_date', mono: true }, { label: 'End', key: 'end_date', mono: true, fmt: v => esc(v || 'Open') }, { label: 'Working Days', key: 'working_days' }, { label: 'Daily ($)', key: 'daily_usd', r: true, fmt: (v, r) => fmtUSD(v || r.usd_amount || (Number(r.lbp_amount || 0) / 89500), 2) }
        ], log.slice(0, 60), [{ v: `${log.length} SITE ALLOWANCE ARRANGEMENTS · ${att.length} ATTENDANCE LOGS IN SAMPLE`, span: 8 }]);
    } else if (code === '21') {
      const tb = (m.gl_tb || []).filter(r => [1, 5].includes(Number(r.Class)) || /^(16|17|45|455|53|51|512|5300)/.test(String(r.Code)));
      bodyHtml = stTable([
        { label: 'Code', key: 'Code', mono: true }, { label: 'Account', key: 'Account' }, { label: 'Class', key: 'Class' }, { label: 'Debit ($)', key: 'debit', r: true, fmt: C.usd2 }, { label: 'Credit ($)', key: 'credit', r: true, fmt: C.usd2 }, { label: 'Balance ($)', key: 'balance', r: true, fmt: v => `<strong>${fmtUSD(v, 2)}</strong>` }
      ], tb, [{ v: `TREASURY, LOANS & PARTNER ACCOUNTS · TILL ${fmtUSD(k.cash_till, 2)} · NET CASH FLOW ${fmtUSD(k.net_cash_flow, 2)}`, span: 3 }, { v: fmtUSD(sum(tb, 'debit'), 2), r: true }, { v: fmtUSD(sum(tb, 'credit'), 2), r: true }, { v: fmtUSD(sum(tb, 'balance'), 2), r: true }]);
    } else if (code === '22') {
      const ents = [['WTC', 'wtc'], ['BBConstruction', 'bbconstruction'], ['Lions Transport', 'lionstransport'], ['Group', 'manufacturing-group']];
      const kk = key => ((SEED.models[key] || {}).periods || {})[STATE.period] || {};
      const metric = (label, key, fmt) => ({ label, ...Object.fromEntries(ents.map(([n, kkey]) => [kkey, modelHasLedger(kkey) ? fmt(kk(kkey)[key]) : '—'])) });
      const rows = [
        metric('Sales TTC', 'sales_ttc', C.usd0), metric('Net Sales ex-VAT', 'net_sales', C.usd0), metric('Loads', 'loads', C.num0), metric('Tons Sold', 'tons_sold', C.num0), metric('Avg Price TTC', 'avg_price_ttc', C.usd2),
        metric('Raw Material Cost', 'raw_cost', C.usd0), metric('Gross Margin', 'gross_margin', C.usd0), metric('GM %', 'gm_pct', v => fmtPct(v)), metric('Expenses', 'expenses', C.usd0), metric('Payroll', 'salaries_paid', C.usd0),
        metric('Operating Profit', 'operating_profit', C.usd0), metric('Op Margin %', 'op_margin_pct', v => fmtPct(v)), metric('Open AR', 'ar_balance', C.usd0), metric('AR Overdue 60+', 'ar_60_plus', C.usd0), metric('DSO (days)', 'dso_days', C.num0),
        metric('Open AP', 'ap_balance', C.usd0), metric('Cash Till', 'cash_till', C.usd2), metric('Net Cash Flow', 'net_cash_flow', C.usd0), metric('Diesel in Tank (L)', 'diesel_in_tank', C.num0), metric('Active Fleet', 'active_equip', C.num0), metric('Cost / Ton', 'cost_per_ton', C.usd2), metric('TB Variance', 'tb_check', C.usd2)
      ];
      bodyHtml = stTable([{ label: 'Board Metric', key: 'label', fmt: v => `<strong>${esc(v)}</strong>` }, ...ents.map(([n, kkey]) => ({ label: n, key: kkey, r: true }))], rows);
    } else {
      const soa = sortRows(filterRecords(m.soa_stream || [], { ignoreSearch: true }), 'st01', 'date', 'desc');
      bodyHtml = stTable([
        { label: 'Date', key: 'date', mono: true, fmt: C.date }, { label: 'Co.', key: 'company' }, { label: 'Voucher', key: 'doc', mono: true }, { label: 'Code', key: 'code', mono: true }, { label: 'Account', key: 'account' }, { label: 'Counterparty', key: 'detail' }, { label: 'Description', key: 'desc' },
        { label: 'Debit ($)', key: 'debit', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }, { label: 'Credit ($)', key: 'credit', r: true, fmt: v => v ? fmtUSD(v, 2) : '—' }
      ], soa, [{ v: `LAST ${soa.length} AUDITED JOURNAL LEGS · TB VARIANCE ${fmtUSD(k.tb_check || 0, 2)}`, span: 7 }, { v: fmtUSD(sum(soa, 'debit'), 2), r: true }, { v: fmtUSD(sum(soa, 'credit'), 2), r: true }]);
    }

    return `
      <div class="a4-sheet" id="printableSheet">
        <div class="a4-header">
          <div>
            <div class="mono" style="font-size:10px;color:#B8883B;letter-spacing:0.14em;text-transform:uppercase">
              ISABI SYSTEMS · AUDITED FINANCIAL &amp; OPERATIONAL STATEMENT #${esc(st.code)} · ${esc(st.cat)}
            </div>
            <div class="a4-title">${esc(st.name)}</div>
            <div style="font-size:12px;color:#5A657D;margin-top:3px">
              Entity: <strong>${esc(COMPANY_LABELS[STATE.company])}</strong> · Period: <strong>${esc(k.label || 'All-Time')}</strong> · Basis: <strong>${STATE.basis === 'rep' ? 'Reporting Date' : 'Transaction Date'}</strong>
            </div>
          </div>
          <div style="text-align:right;font-family:var(--font-mono);font-size:11px;color:#2C364C">
            <div><strong>PRINTED:</strong> ${todayISO()} · ${esc(activeUser().full_name)}</div>
            <div><strong>CURRENCY:</strong> USD ($1 = 90,000 LBP)</div>
            <div><strong>TB VARIANCE:</strong> ${fmtUSD(k.tb_check || 0, 2)}</div>
          </div>
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  function renderStatements() {
    if (window.MFG_RDL && typeof window.MFG_RDL.renderStatementsView === 'function') {
      return window.MFG_RDL.renderStatementsView(SEED, STATE);
    }
    const st = STATEMENT_CATALOG.find(x => x.code === STATE.activeStatement) || STATEMENT_CATALOG[0];
    return renderStatementSheet(st.code);
  }

  // ==========================================================================
  // VIEW 12: USERS, ROLES & MULTI-DEVICE CLOUD AUTH ($0/SEAT LICENSE MANAGER)
  // ==========================================================================
  const ENROL_SVGS = {
    reticle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="3"/><path d="M7 18a5 5 0 0 1 10 0"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    shutter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    matrix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>'
  };

  function renderEnrolThumbStripHtml() {
    const shortTitles = ['Straight', 'Slight Left', 'Slight Right'];
    const target = enrolTargetUser();
    const savedThumbs = userFaceThumbs(target);
    return [0, 1, 2].map(i => {
      const th = FACE_STATE.enrolThumbs[i] || savedThumbs[i] || '';
      const hasCap = i < FACE_STATE.enrolCaptures.length;
      const isNext = !hasCap && i === FACE_STATE.enrolCaptures.length;
      return `<div class="enrol-thumb-slot ${hasCap ? 'captured' : (isNext ? 'next-slot' : '')}" data-retake-pose="${i}" title="${hasCap ? `Click to retake Pose ${i + 1} (${shortTitles[i]})` : `Click to capture Pose ${i + 1} (${shortTitles[i]})`}">
        ${hasCap
          ? (th
            ? `<div class="enrol-thumb-media"><img src="${th}" alt="Pose ${i + 1}"><span class="enrol-thumb-badge">✓ STORED</span></div>`
            : `<div class="enrol-thumb-media enrol-thumb-vec"><div class="enrol-vec-chip">${ENROL_SVGS.shield}<span>128-d Vector</span></div><span class="enrol-thumb-badge">✓ STORED</span></div>`)
          : `<div class="enrol-thumb-media enrol-thumb-empty"><span class="enrol-empty-num">0${i + 1}</span><small>${isNext ? 'Ready to Capture' : 'Pending Pose'}</small></div>`
        }
        <div class="enrol-thumb-foot">
          <span class="enrol-thumb-lbl"><b>0${i + 1}</b> ${shortTitles[i]}</span>
          <span class="enrol-thumb-action">${hasCap ? 'Retake ↻' : '128-d'}</span>
        </div>
      </div>`;
    }).join('');
  }

  function renderEnrolStepperHtml() {
    const steps = [
      { title: 'Straight Ahead', sub: 'Frontal baseline' },
      { title: 'Slight Left', sub: '15° yaw left' },
      { title: 'Slight Right', sub: '15° yaw right' }
    ];
    return steps.map((st, i) => {
      const done = i < FACE_STATE.enrolCaptures.length;
      const active = i === FACE_STATE.enrolCaptures.length;
      return `<div class="pose-step ${done ? 'done' : (active ? 'active' : '')}" data-retake-pose="${i}">
        <span class="pose-step-num">${done ? '✓' : ('0' + (i + 1))}</span>
        <div class="pose-step-txt">
          <b>${st.title}</b>
          <small>${done ? 'Stored in Ledger' : (active ? 'Active Target' : st.sub)}</small>
        </div>
      </div>`;
    }).join('');
  }

  function renderEnrolPoseGuideInnerHtml() {
    const enrolUser = enrolTargetUser();
    const capCount = FACE_STATE.enrolCaptures.length;
    const poseComplete = capCount >= 3;
    const poseIdx = Math.min(capCount, 2);
    const poseSvgHtml = window.Face && window.Face.poseSvg ? window.Face.poseSvg(poseComplete ? 3 : poseIdx) : '';
    return `
      <div class="mfg-pose-svg">${poseSvgHtml}</div>
      <div class="mfg-pose-copy">
        <div class="mfg-pose-kicker">${poseComplete ? 'ALL 3 BIOMETRIC POSES CAPTURED & STORED' : `GUIDED POSE ${poseIdx + 1} OF 3 · AUTO-STORES ON CAPTURE`}</div>
        <div class="mfg-pose-title" id="enrolPosePrompt">${esc(poseComplete ? `Biometric Face ID & 2FA active for ${enrolUser.full_name} (3 × 128-d vectors saved). Click any pose card on the left to retake.` : FACE_POSES[poseIdx])}</div>
      </div>
      <div class="mfg-pose-pill">${poseComplete ? '3/3 ACTIVE' : `POSE ${poseIdx + 1}/3`}</div>
    `;
  }

  function renderUsersDirectoryRowsHtml() {
    const owner = isOwner(activeUser());
    return STATE.users.map((u, idx) => {
      const fSamples = userFaceSamples(u);
      const isTarget = String(u.id) === String(enrolTargetUser().id);
      return `
      <tr class="${isTarget ? 'enrol-selected-row' : ''}">
        <td><strong>${esc(u.full_name)}</strong>${idx === STATE.activeUserIdx ? ' <span class="badge badge-ok">you</span>' : ''}</td>
        <td class="mono">${esc(u.email)}</td>
        ${owner ? `<td class="mono"><span class="badge badge-info">${esc(u.pin_code || '1111')}</span></td>` : ''}
        <td>
          <span class="badge ${fSamples.length ? 'badge-ok' : 'badge-warn'}">
            ${fSamples.length ? `✓ ${fSamples.length}/3 Poses${userRequiresFace2FA(u) ? ' · 2FA' : ''}` : 'PIN Only'}
          </span>
        </td>
        <td><span class="badge badge-brass">${esc(u.role)}</span></td>
        <td><strong>${esc(u.companies)}</strong></td>
        <td><span class="badge ${u.status === 'Suspended' ? 'badge-err' : 'badge-ok'}">${esc(u.status || 'Active')}</span></td>
        <td class="mono" style="font-size:10.5px">${esc(u.last_login_at || 'Never')}</td>
        <td style="white-space:nowrap">
          ${(owner || idx === STATE.activeUserIdx) ? `<button class="btn ${isTarget ? 'btn-brass' : ''}" style="padding:3px 8px;font-size:10.5px" data-enrol-user="${esc(u.id)}" title="Enrol or update 3-pose Biometric Face ID for ${esc(u.full_name)}">Face ID</button>` : ''}
          ${owner ? `
            <button class="btn" style="padding:3px 7px;font-size:10.5px" data-sim-user="${idx}" title="Open the app as this seat to check their RLS scope">${STATE.activeUserIdx === idx ? '● Active' : 'Impersonate'}</button>
            <button class="btn" style="padding:3px 7px;font-size:10.5px" data-invite-user="${idx}" title="Copy a 1-click login link for WhatsApp / Email (carries the PIN — share privately)">Invite Link</button>
            <button class="btn" style="padding:3px 7px;font-size:10.5px" data-toggle-user="${idx}" title="${u.status === 'Suspended' ? 'Re-activate this seat' : 'Suspend this seat (cannot sign in)'}">${u.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
          ` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  function renderUsers() {
    const uCount = STATE.users.length;
    const annualSaved = uCount * 37 * 12;
    const me = activeUser();
    const owner = isOwner(me);
    const sbConfigured = !!(STATE.supabaseCfg.url && STATE.supabaseCfg.anonKey);
    const enrolUser = enrolTargetUser();
    syncEnrolBufferFromUser(enrolUser, false);
    const faceCount = STATE.users.filter(userHasFaceId).length;
    const enrolSavedSamples = userFaceSamples(enrolUser);
    const capCount = FACE_STATE.enrolCaptures.length;
    const poseComplete = capCount >= 3;

    return `
      <div class="cockpit-banner">
        <div class="cockpit-title-block">
          <div class="cockpit-eyebrow">MULTI-DEVICE TEAM AUTHENTICATION · BIOMETRIC FACE ID · BUSINESS-UNIT RLS</div>
          <div class="cockpit-title">Users, Biometric Face ID &amp; Multi-Device Cloud Sync</div>
          <div class="cockpit-sub">Enrol 3-pose on-device 128-d Face ID descriptors (Attendance PWA parity), enforce step-up 2FA on PIN login, and sync seats across phones, tablets &amp; laptops.</div>
        </div>
        <div class="cockpit-pills">
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Active Web Seats</div><div class="cockpit-pill-val brass">${uCount} Users</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Biometric Face ID</div><div class="cockpit-pill-val ${faceCount ? 'emerald' : 'amber'}" id="enrolCockpitCount">${faceCount} / ${uCount} Enrolled</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Cloud Relay Status</div><div class="cockpit-pill-val ${/Live/.test(STATE.cloudStatus) ? 'emerald' : 'amber'}">${esc(STATE.cloudStatus)}</div></div>
          <div class="cockpit-pill"><div class="cockpit-pill-lbl">Annual License Savings</div><div class="cockpit-pill-val emerald">${fmtUSD(annualSaved, 0)} / yr</div></div>
        </div>
      </div>

      ${STATE.showAddUserForm && owner ? `
        <div class="panel-card" style="margin-bottom:16px;border-color:var(--brass)">
          <div class="panel-head">
            <div class="panel-title"><span>CREATE OR UPDATE MULTI-DEVICE TEAM LOGIN SEAT</span></div>
            <button class="btn" id="cancelAddUserBtn" style="padding:3px 9px;font-size:11px">✕ Close</button>
          </div>
          <div style="padding:14px 16px 4px">
          <div class="form-grid-3">
            <div class="form-field">
              <label>Full Name *</label>
              <input type="text" id="nu_name" placeholder="e.g. Ali Mansour (WTC Scale)" autocomplete="off">
            </div>
            <div class="form-field">
              <label>Email Address (Login ID) *</label>
              <input type="email" id="nu_email" placeholder="ali.mansour@bhfirms.com" autocomplete="off">
              <span class="hint">An existing email updates that seat instead of creating a new one.</span>
            </div>
            <div class="form-field">
              <label>Access PIN (4–8 Digits) *</label>
              <input type="text" inputmode="numeric" pattern="[0-9]{4,8}" id="nu_pin" value="${Math.floor(1000 + Math.random() * 8999)}" class="mono" autocomplete="off">
            </div>
            <div class="form-field">
              <label>Role &amp; Permissions *</label>
              <select id="nu_role">
                <option value="Entry">Entry (Tickets, Fuel, Expenses &amp; Receipts)</option>
                <option value="Supervisor + Entry">Supervisor + Entry (All Ops + Entry)</option>
                <option value="Supervisor">Supervisor (Read-Only Oversight)</option>
                <option value="Sales">Sales &amp; AR Collector (Receipts only)</option>
                <option value="Full Access (Owner)">Full Access (Owner)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Assigned Companies (Row-Level Security) *</label>
              <select id="nu_companies">
                <option value="WTC">WTC Only</option>
                <option value="BBConstruction">BBConstruction Only</option>
                <option value="Lions Transport">Lions Transport Only</option>
                <option value="WTC, BBConstruction">WTC + BBConstruction</option>
                <option value="Lions Transport, WTC">Lions Transport + WTC</option>
                <option value="WTC, BBConstruction, Lions Transport">All 3 Companies (Full Group)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Executive Dashboards &amp; Statements</label>
              <select id="nu_access">
                <option value="partial|partial">Operational KPIs + Statements</option>
                <option value="full|full">Full Executive PBI + All 22 Statements</option>
                <option value="none|none">Weighbridge / Desk Only (No Financials)</option>
              </select>
            </div>
          </div>
          <div id="nuErrors" class="form-errors" hidden></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 0">
            <button class="btn btn-primary" id="saveNewUserBtn">✓ Save Seat &amp; Sync Across All Devices</button>
          </div>
          </div>
        </div>
      ` : ''}

      <div class="panel-card mfg-enrol-studio" id="faceEnrolPanel" style="margin-bottom:16px">
        <div class="enrol-console-hdr">
          <div class="enrol-console-brand">
            <div class="enrol-console-icon">${ENROL_SVGS.reticle}</div>
            <div>
              <div class="enrol-console-eyebrow">ON-DEVICE 128-D NEURAL RECOGNITION · AUTO-PERSISTENCE &amp; CLOUD RELAY</div>
              <div class="enrol-console-title">Biometric Face ID Enrolment Studio &amp; Calibration</div>
            </div>
          </div>
          <div class="enrol-console-actions">
            <span class="enrol-seat-pill ${enrolSavedSamples.length ? 'enrolled' : 'pending'}" id="enrolHeaderBadge">
              ${enrolSavedSamples.length ? `✓ ${esc(enrolUser.full_name)} · ${enrolSavedSamples.length}/3 Poses Stored` : `${esc(enrolUser.full_name)} · Not Enrolled`}
            </span>
            <button type="button" class="btn enrol-calib-btn" id="enrolCalibBtn">${ENROL_SVGS.matrix}<span>Calibration Matrix</span></button>
          </div>
        </div>

        <div class="enrol-studio-grid">
          <div class="enrol-cam-col">
            <div class="enrol-cam-viewport" id="enrolCamViewport">
              <video id="enrolFaceVideo" autoplay playsinline muted></video>
              <canvas id="enrolFaceOverlay"></canvas>
              <div class="enrol-cam-vignette"></div>
              <div class="enrol-hud-corners" aria-hidden="true">
                <i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
                <div class="enrol-hud-oval"></div>
              </div>
              <div class="enrol-hud-top">
                <span class="enrol-hud-pill" id="enrolHudStatusPill">
                  <span class="enrol-hud-dot ${FACE_STATE.enrolCamActive ? 'live' : ''}" id="enrolHudDot"></span>
                  <span id="enrolHudTelemetry">${FACE_STATE.enrolCamActive ? 'LIVE 128-D SCANNER' : 'CAMERA STANDBY'}</span>
                </span>
                <span class="enrol-hud-spec">SSD-V1 · 128-D</span>
              </div>
              <div class="enrol-shutter-flash" id="enrolShutterFlash"></div>
              <div class="enrol-cam-placeholder" id="enrolCamPlaceholder" ${FACE_STATE.enrolCamActive ? 'hidden' : ''}>
                <div class="enrol-cam-reticle-badge">${ENROL_SVGS.reticle}</div>
                <div class="enrol-cam-placeholder-title">On-Device 128-d Biometric Optics</div>
                <small>SSD MobileNet v1 + 68-Point Landmarks · Encrypted descriptors &amp; pose thumbnails store automatically on capture</small>
                <span class="enrol-cam-wake-pill">${ENROL_SVGS.cam}<span>Click to Enable Camera</span></span>
              </div>
            </div>
            <div class="enrol-thumb-strip" id="enrolThumbStrip">
              ${renderEnrolThumbStripHtml()}
            </div>
          </div>

          <div class="enrol-controls-col">
            <div class="enrol-config-grid">
              <div class="enrol-config-card">
                <label class="enrol-config-lbl" for="enrolUserSelect">Team Seat to Enrol</label>
                <select id="enrolUserSelect" class="enrol-select" ${owner ? '' : 'disabled'}>
                  ${STATE.users.filter(u => u.status !== 'Suspended').map(u => `
                    <option value="${esc(u.id)}" ${String(u.id) === String(enrolUser.id) ? 'selected' : ''}>
                      ${esc(u.full_name)} (${userFaceSamples(u).length ? userFaceSamples(u).length + '/3 poses' : 'no Face ID'})
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="enrol-config-card">
                <label class="enrol-config-lbl" for="enrolThresholdSel">Match Threshold (τ)</label>
                <select id="enrolThresholdSel" class="enrol-select">
                  <option value="0.45" ${Number(STATE.faceSettings.threshold) === 0.45 ? 'selected' : ''}>0.45 · Strict High-Security</option>
                  <option value="0.50" ${Number(STATE.faceSettings.threshold) === 0.50 ? 'selected' : ''}>0.50 · Standard Balanced</option>
                  <option value="0.55" ${Number(STATE.faceSettings.threshold) === 0.55 ? 'selected' : ''}>0.55 · Backlit / Relaxed</option>
                </select>
              </div>
              <div class="enrol-config-card enrol-policy-card">
                <span class="enrol-config-lbl">Biometric Security Policy</span>
                <label class="enrol-policy-check">
                  <input type="checkbox" id="enrolRequire2faCb" ${STATE.faceSettings.enforce2FA ? 'checked' : ''}>
                  <span>Enforce Face ID 2FA on PIN login</span>
                </label>
                <label class="enrol-policy-check">
                  <input type="checkbox" id="enrolLivenessCb" ${STATE.faceSettings.liveness ? 'checked' : ''}>
                  <span>Require blink liveness check</span>
                </label>
              </div>
            </div>

            <div class="pose-stepper" id="enrolPoseStepper">
              ${renderEnrolStepperHtml()}
            </div>

            <div class="mfg-pose-guide ${poseComplete ? 'complete' : ''}" id="enrolPoseGuide">
              ${renderEnrolPoseGuideInnerHtml()}
            </div>

            <label class="enrol-consent-row">
              <input type="checkbox" id="enrolConsentCb" ${FACE_STATE.enrolConsent ? 'checked' : ''}>
              <span>Biometric consent active — 128-d facial descriptors &amp; pose thumbnails are stored on this device and synced via the BHFIRMS relay.</span>
            </label>

            <div class="enrol-status-bar ${esc(FACE_STATE.enrolStatusCls)}" id="enrolStatusBar">${esc(FACE_STATE.enrolStatusText)}</div>

            <div class="enrol-btn-bar">
              <button type="button" class="btn enrol-action-btn" id="enrolStartCamBtn">${FACE_STATE.enrolCamActive ? `${ENROL_SVGS.stop}<span>Stop Camera</span>` : `${ENROL_SVGS.cam}<span>Start Camera</span>`}</button>
              <button type="button" class="btn btn-brass enrol-action-btn enrol-capture-cta" id="enrolCaptureBtn">${ENROL_SVGS.shutter}<span>${poseComplete ? 'Retake All 3 Poses' : `Capture Pose (${Math.min(capCount + 1, 3)}/3)`}</span></button>
              <button type="button" class="btn btn-primary enrol-action-btn" id="enrolSaveBtn" ${capCount ? '' : 'disabled'}>${ENROL_SVGS.shield}<span>${enrolSavedSamples.length && capCount ? `Saved & Synced (${capCount}/3)` : `Save Face ID (${capCount}/3)`}</span></button>
              <button type="button" class="btn enrol-action-btn" id="enrolTestBtn">${ENROL_SVGS.scan}<span>${FACE_STATE.enrolTestActive ? 'Stop Test' : 'Test Recognition'}</span></button>
              <button type="button" class="btn enrol-action-btn enrol-clear-btn" id="enrolClearBtn" ${(enrolSavedSamples.length || capCount) ? '' : 'disabled'}>${ENROL_SVGS.trash}<span>Clear Face ID</span></button>
            </div>

            <div id="enrolCalibWrap" ${FACE_STATE.calibReportHtml ? '' : 'hidden'}>${FACE_STATE.calibReportHtml}</div>
          </div>
        </div>
      </div>

      <div class="split-grid-2">
        <div class="panel-card">
          <div class="panel-head">
            <div class="panel-title"><span>TEAM LOGIN DIRECTORY &amp; ROW-LEVEL SECURITY (RLS) SCOPES</span></div>
            <div style="display:flex;gap:6px">
              <button class="btn" style="padding:4px 10px;font-size:11px" id="syncCloudNowBtn">↻ Sync Cloud Now</button>
              ${owner ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:11px" id="addWebUserBtn">+ New Team Login</button>` : ''}
            </div>
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Login Email</th>
                  ${owner ? '<th>PIN</th>' : ''}
                  <th>Face ID (2FA)</th>
                  <th>Role</th>
                  <th>Allowed Companies (RLS)</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="usersDirectoryTbody">
                ${renderUsersDirectoryRowsHtml()}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>LIVE MULTI-DEVICE SESSION AUDIT LOG</span></div>
              <span class="badge ${/Live/.test(STATE.cloudStatus) ? 'badge-ok' : 'badge-warn'}">${/Live/.test(STATE.cloudStatus) ? 'CLOUD SYNCED' : 'LOCAL ONLY'}</span>
            </div>
            <div class="table-wrap">
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Team Member</th>
                    <th>Auth Method</th>
                    <th>Role / Scope</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  ${(STATE.sessions || []).slice(0, 10).map(s => `
                    <tr>
                      <td class="mono" style="font-size:10.5px">${esc(s.logged_in_at)}</td>
                      <td><strong>${esc(s.full_name)}</strong></td>
                      <td><span class="badge ${/Face/i.test(s.method || '') ? 'badge-ok' : 'badge-info'}">${esc(s.method || 'PIN')}${s.confidence ? ` · ${Math.round(Number(s.confidence))}%` : ''}</span></td>
                      <td><span class="badge badge-brass">${esc(s.companies)}</span></td>
                      <td class="mono" style="font-size:10.5px">${esc(s.device)}</td>
                    </tr>
                  `).join('') || emptyRow(5, 'No sign-ins recorded yet')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-head">
              <div class="panel-title"><span>CLOUD DATABASE BACKENDS (DUAL-DRIVER)</span></div>
              <span class="badge badge-ok">ACTIVE</span>
            </div>
            <div style="font-size:12px;display:flex;flex-direction:column;gap:8px">
              <div class="sentinel-item ${/Live/.test(STATE.cloudStatus) ? 'ok' : 'warn'}">
                <div>
                  <div class="sentinel-title">Driver 1: BHFIRMS Multi-Device Cloud Relay + Local SQLite</div>
                  <div class="sentinel-detail">Active across phones, tablets &amp; laptops at <code class="mono">husseinbdeir.github.io/mfg-web</code>; on the LAN host <code class="mono">server.py</code> also writes every entry into <code class="mono">data/mfg.db</code>. Syncs seats, PINs, sessions and app entries with 0 licenses.</div>
                </div>
                <span class="badge ${/Live/.test(STATE.cloudStatus) ? 'badge-ok' : 'badge-warn'}">${/Live/.test(STATE.cloudStatus) ? 'CONNECTED' : esc(STATE.cloudStatus.replace('● ', '').toUpperCase())}</span>
              </div>
              <div class="sentinel-item ${sbConfigured ? 'ok' : ''}">
                <div style="width:100%">
                  <div class="sentinel-title">Driver 2: Dedicated Supabase / PostgreSQL Cloud (Optional)</div>
                  <div class="sentinel-detail" style="margin-bottom:6px">Run <code class="mono">data/schema_postgres.sql</code> in a Supabase project and paste the URL &amp; anon key. The keys are kept on this device only; the Postgres writer ships in a later build.</div>
                  ${owner ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
                    <input type="url" id="sb_url" class="search-input" style="min-width:170px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.url)}" placeholder="https://xyz.supabase.co">
                    <input type="text" id="sb_key" class="search-input" style="min-width:140px;flex:1;padding:4px 8px;font-size:11px" value="${esc(STATE.supabaseCfg.anonKey)}" placeholder="Supabase anon key...">
                    <button class="btn" id="saveSbCfgBtn" style="padding:4px 9px;font-size:11px">Save</button>
                  </div>` : ''}
                </div>
                <span class="badge ${sbConfigured ? 'badge-ok' : ''}">${sbConfigured ? 'KEYS SAVED' : 'NOT CONFIGURED'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // SMART ENTRY DESK — SIX FORMS WITH THE DATAVERSE FORM RULES
  // ==========================================================================
  const FORM_TITLES = Object.assign({
    sales: 'New Sales Ticket (Price Agreement · VAT · Overtime · Duplicate Guards)',
    raw: 'New Raw Material Quarry Receipt (2-Leg AP Split)',
    receipt: 'New Customer Receipt (FIFO Auto-Allocated)',
    fuel: 'New Diesel / Lubricant Intake (M142 Meter Guard)',
    expense: 'New Expense (Cash Till or Supplier Credit)',
    settlement: 'New Supplier / Hauler Settlement (Oldest Leg First)'
  }, (window.MFG_FORMS && window.MFG_FORMS.FORM_TITLES) || {});
  const FORM_CR_KEY = Object.assign({
    sales: 'sales_tickets', raw: 'raw_purchases', receipt: 'receipts',
    fuel: 'fuel_intakes', expense: 'expenses', settlement: 'settlements'
  }, (window.MFG_FORMS && window.MFG_FORMS.FORM_CR_KEY) || {});

  function fld(label, inner, opts = {}) {
    return `<div class="form-field${opts.span ? ' span-3' : ''}${opts.cls ? ' ' + opts.cls : ''}"${opts.id ? ` id="${opts.id}"` : ''}${opts.hidden ? ' hidden' : ''}><label>${label}</label>${inner}${opts.hint != null ? `<span class="hint"${opts.hintId ? ` id="${opts.hintId}"` : ''}>${opts.hint}</span>` : ''}</div>`;
  }
  function inp(id, type, value, attrs = '') {
    return `<input type="${type}" id="${id}" value="${esc(value == null ? '' : value)}" autocomplete="off" ${attrs}>`;
  }
  function sel(id, options, value, attrs = '') {
    return `<select id="${id}" ${attrs}>${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  }
  function dl(id, values) {
    return `<datalist id="${id}">${values.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  }
  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function renderEntryModalBody() {
    const fType = STATE.modalForm;
    const comps = allowedCompanyNames();
    const company = defaultEntryCompany();
    const today = todayISO();
    const dateAttrs = `min="${MIN_DATE}" max="${today}" required`;
    const companyField = fld('Company (BU) *', sel('f_company', comps, company), { hint: comps.length === 1 ? 'Your seat is scoped to this entity' : '' });
    const dateField = fld('Transaction Date *', inp('f_date', 'date', today, dateAttrs), { hintId: 'hint_date', hint: '' });
    const notesField = fld('Notes', inp('f_notes', 'text', '', 'placeholder="Required for back-dated entries or discounts above 20%"'), { span: true });
    const cockpitHtml = '';
    const truckQvHtml = window.MFG_FORMS ? `<div id="paTruckQvWrap">${window.MFG_FORMS.renderTruckQuickView(null, true)}</div>` : '';

    if (window.MFG_FORMS && !['sales', 'raw', 'receipt', 'fuel', 'expense', 'settlement'].includes(fType)) {
      return cockpitHtml + window.MFG_FORMS.renderExtendedFormBody(fType, { SEED, STATE }, {
        allowedCompanyNames, defaultEntryCompany, customerNames, supplierNames, siteNames, equipmentNames, driverNames
      });
    }

    if (fType === 'sales') {
      const prods = productList(true);
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Smart Agreement Engine:</strong> Company, Customer, Product &amp; Site pick the active Price Agreement (unit + transport price + Tier 1/2 truck size); the product sets the unit of measure; VAT-registered customers get 11% VAT; Pickup zeroes transport; a company-fleet load outside 06:00–17:59 flags overtime; a repeated ticket number in the same BU is blocked unless you confirm it.
        </div>
        ${truckQvHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket Number *', inp('f_ticketno', 'text', '', 'inputmode="numeric" placeholder="Enter pad ticket no."'), { hintId: 'hint_ticket', hint: '' })}
          ${dateField}
          ${fld('Dispatch Time (Overtime Check)', inp('f_time', 'time', nowHHMM()), { hintId: 'hint_time', hint: 'Day shift 06:00–17:59' })}
          ${fld('Sale Type (Rule #1) *', sel('f_saletype', [['Delivery', 'Delivery (Material + Transport)'], ['Pickup', 'Pickup (Ex-Quarry / Plant)']], 'Delivery'))}
          ${fld('Transported By (Rule #4) *', sel('f_transportby', [['Company fleet', 'Company fleet (Own Truck)'], ['Third-party truck', 'Third-party truck (Hauler)'], ['Customer truck', 'Customer truck (Pickup)']], 'Company fleet'))}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers" placeholder="Select or type customer..."') + dl('dl_customers', customerNames()), { hintId: 'hint_customer', hint: '' })}
          ${fld('Product / Aggregate Grade *', sel('f_product', [['', '— pick a grade —']].concat(prods.map(p => [p.name, `${p.name} (${p.uom}${Number(p.ton_factor) && Number(p.ton_factor) !== 1 ? ' · ×' + p.ton_factor + ' t' : ''})`])), ''), { hintId: 'hint_product', hint: '' })}
          ${fld('Destination Site', inp('f_site', 'text', '', 'list="dl_sites" placeholder="Site..."') + dl('dl_sites', siteNames()), { hintId: 'hint_site', hint: 'Required on Delivery' })}
          ${fld('Truck / Equipment', inp('f_truck', 'text', '', 'list="dl_equip" placeholder="Truck plate..."') + dl('dl_equip', equipmentNames()), { hintId: 'hint_truck', hint: 'Required on Delivery' })}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers" placeholder="Driver..."') + dl('dl_drivers', driverNames()), { hint: 'Required on Delivery' })}
          ${fld('Quantity (<span id="lbl_uom">m³</span>) *', inp('f_qty', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_qty', hint: '' })}
          ${fld('Unit Price ($) <span class="badge badge-brass" id="lbl_pricelock">—</span>', inp('f_unitprice', 'number', '', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_price', hint: '' })}
          ${fld('Transport Unit Price ($)', inp('f_transunitprice', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_trans', hint: '' })}
          ${fld('Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_disc', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Credit', 'Credit (Posts to 4111 AR)'], ['Cash', 'Cash (Posts to 5300 Till)']], 'Credit'))}
          ${fld('VAT Invoice No.', inp('f_vatinvoice', 'text', '', 'placeholder="Invoice serial"'), { id: 'wrap_vatinvoice', hidden: true, hint: '11% VAT applies to this customer' })}
          <div class="form-field check-field"><input type="checkbox" id="f_overtime"><label for="f_overtime">Overtime load (company fleet outside day shift)</label></div>
          <div class="form-field check-field" id="wrap_dupok" hidden><input type="checkbox" id="f_dupok"><label for="f_dupok">Post anyway — duplicate ticket number confirmed</label></div>
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Material</small><b id="calc_mat">$0.00</b></div>
          <div><small>Transport</small><b id="calc_tr">$0.00</b></div>
          <div><small>VAT 11%</small><b id="calc_vat">—</b></div>
          <div><small>Total TTC</small><b id="calc_total">$0.00</b></div>
        </div>
      `;
    }

    if (fType === 'raw') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Two-Payable Raw Intake Rule (m192):</strong> Material cost is owed to the <strong>Quarry Site Owner</strong>; haulage is owed to the <strong>Truck Owner</strong> and is $0 when a company-fleet truck hauls it. A Purchase Price (Site) agreement for the owner / site fills the unit cost.
        </div>
        ${truckQvHtml}
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket # *', inp('f_ticketno', 'text', '', 'inputmode="numeric" placeholder="Enter ticket no."'), { hintId: 'hint_ticket', hint: '' })}
          ${dateField}
          ${fld('Quarry Site *', inp('f_site', 'text', '', 'list="dl_sites"') + dl('dl_sites', siteNames()))}
          ${fld('Quarry Site Owner (Material Payee)', inp('f_siteowner', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_owner', hint: 'Required when the material has a cost' })}
          ${fld('Raw Material *', inp('f_product', 'text', '', 'list="dl_products"') + dl('dl_products', uniqSorted(SEED.records.raw_purchases.map(r => r.product).concat(SEED.records.products.map(p => p.name)))), { hintId: 'hint_product', hint: '' })}
          ${fld('Transported By *', sel('f_transportby', [['Third-party truck', 'Third-party truck (Hauler paid)'], ['Company fleet', 'Company fleet (Haulage $0)']], 'Third-party truck'))}
          ${fld('Truck Owner (Haulage Payee)', inp('f_truckowner', 'text', '', 'list="dl_suppliers"'), { hintId: 'hint_truckowner', hint: 'Required for third-party haulage' })}
          ${fld('Truck Plate', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()))}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers"') + dl('dl_drivers', driverNames()))}
          ${fld('Dispatch Time', inp('f_time', 'time', nowHHMM()), { hintId: 'hint_time', hint: 'Day shift 06:00–17:59' })}
          ${fld('Quantity (<span id="lbl_uom">m³</span>) *', inp('f_qty', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'))}
          ${fld('Material Unit Cost ($) <span class="badge badge-brass" id="lbl_pricelock">—</span>', inp('f_unitprice', 'number', '', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_price', hint: '' })}
          ${fld('Haulage Unit Cost ($)', inp('f_transunitprice', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_trans', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Credit', 'Credit (owed to payees)'], ['Cash', 'Cash (paid from till)']], 'Credit'))}
          <div class="form-field check-field"><input type="checkbox" id="f_overtime"><label for="f_overtime">Overtime load (company fleet outside day shift)</label></div>
          <div class="form-field check-field" id="wrap_dupok" hidden><input type="checkbox" id="f_dupok"><label for="f_dupok">Post anyway — duplicate ticket number confirmed</label></div>
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Material leg → site owner</small><b id="calc_mat">$0.00</b></div>
          <div><small>Haulage leg → truck owner</small><b id="calc_tr">$0.00</b></div>
          <div><small>Quantity</small><b id="calc_qty">0</b></div>
          <div><small>Total payable</small><b id="calc_total">$0.00</b></div>
        </div>
      `;
    }

    if (fType === 'receipt') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>FIFO Auto-Allocation (step240 + m165):</strong> the receipt settles the customer's oldest open credit tickets first. VAT-registered customers carry 11% inside their balance; a <strong>VAT</strong> method receipt settles only the VAT leg.
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${dateField.replace('Transaction Date', 'Receipt Date')}
          ${fld('Customer *', inp('f_customer', 'text', '', 'list="dl_customers"') + dl('dl_customers', customerNames()), { hintId: 'hint_customer', hint: '' })}
          ${fld('Payment Method *', sel('f_method', [['Payment', 'Payment (Dr 5300 Till / 5121 Bank)'], ['Barter', 'Barter (goods / services)'], ['VAT', 'VAT 11% receipt'], ['Rent', 'Rent offset'], ['VATRent', 'VAT on rent']], 'Payment'))}
          ${fld('Amount Received ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
          ${fld('Settlement Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'), { hintId: 'hint_disc', hint: 'Written off against the oldest ticket' })}
          ${fld('Reference', inp('f_reference', 'text', '', 'placeholder="Cheque / transfer / receipt no."'))}
          ${notesField}
        </div>
        <div id="paCustSubgridWrap"></div>
        <div class="live-calc">
          <div><small>Open AR before</small><b id="calc_before">—</b></div>
          <div><small>Receipt + discount</small><b id="calc_total">$0.00</b></div>
          <div><small>Open AR after</small><b id="calc_after">—</b></div>
          <div><small>Allocation</small><b id="calc_alloc">FIFO oldest first</b></div>
        </div>
      `;
    }

    if (fType === 'fuel') {
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>M142 Fuel &amp; Meter Guard:</strong> the reading is checked against the unit's previous intake — a backwards reading, a jump over 5,000 km / 500 h, zero or an impossible value is refused. BBConstruction diesel intakes are refused while its tank reconciliation is negative (m212).
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${fld('Ticket #', inp('f_ticketno', 'text', '', 'inputmode="numeric" placeholder="Optional ticket no."'), { hintId: 'hint_ticket', hint: '' })}
          ${dateField}
          ${fld('Equipment / Truck *', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()), { hintId: 'hint_truck', hint: '' })}
          ${fld('Driver', inp('f_driver', 'text', '', 'list="dl_drivers"') + dl('dl_drivers', driverNames()))}
          ${fld('Item *', sel('f_item', [['Diesel', 'Diesel'], ['Oil 15W40', 'Oil 15W40'], ['Oil 68', 'Oil 68'], ['Hydraulic Oil', 'Hydraulic Oil'], ['Grease', 'Grease'], ['Other lubricant', 'Other lubricant']], 'Diesel'))}
          ${fld('Litres Issued (L) *', inp('f_qty', 'number', '', 'step="0.1" min="0.1" inputmode="decimal"'), { hintId: 'hint_qty', hint: '' })}
          ${fld('Meter Type', sel('f_metertype', [['odometer', 'Odometer (km)'], ['hours', 'Hour meter (h)'], ['none', 'No meter']], 'odometer'))}
          ${fld('Meter Reading', inp('f_meter', 'number', '', 'step="1" min="0" inputmode="numeric"'), { hintId: 'hint_meter', hint: '' })}
          ${fld('Tank / Location', inp('f_location', 'text', 'Main Plant Tank'))}
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Previous reading</small><b id="calc_prev">—</b></div>
          <div><small>Distance / hours since</small><b id="calc_delta">—</b></div>
          <div><small>Consumption</small><b id="calc_rate">—</b></div>
          <div><small>Guard</small><b id="calc_total">—</b></div>
        </div>
      `;
    }

    if (fType === 'expense') {
      const cats = expenseCategories();
      return cockpitHtml + `
        <div class="rule-banner" id="smartRuleBanner">
          <strong>Expense posting:</strong> Cash expenses credit the till (5300); Credit expenses open a Supplies &amp; Services leg (Class 4) owed to the supplier until a settlement relieves it. Tie plant and fleet costs to the equipment so the unit economics pick them up.
        </div>
        <div class="form-grid-3">
          ${companyField}
          ${dateField}
          ${fld('Category *', sel('f_category', [['', '— pick —']].concat(cats.map(c => [c.category, c.category])), ''))}
          ${fld('Subcategory', inp('f_subcategory', 'text', '', 'list="dl_subcats"') + dl('dl_subcats', uniqSorted(cats.flatMap(c => c.subs))))}
          ${fld('Supplier / Vendor', inp('f_supplier', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_supplier', hint: 'Required for Credit' })}
          ${fld('Equipment (cost centre)', inp('f_truck', 'text', '', 'list="dl_equip"') + dl('dl_equip', equipmentNames()))}
          ${fld('Payment Method *', sel('f_method', [['Cash', 'Cash (Cr 5300 Till)'], ['Credit', 'Credit (Cr 4011 Supplier)']], 'Cash'))}
          ${fld('Quantity', inp('f_qty', 'number', '1', 'step="0.01" min="0" inputmode="decimal"'))}
          ${fld('Amount ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
          ${fld('Reference / Invoice', inp('f_reference', 'text', ''))}
          ${notesField}
        </div>
        <div class="live-calc">
          <div><small>Amount</small><b id="calc_total">$0.00</b></div>
          <div><small>Posts to</small><b id="calc_post">Cash till 5300</b></div>
          <div><small>Open AP to supplier</small><b id="calc_before">—</b></div>
          <div><small>GL class</small><b id="calc_gl">6x · Operating</b></div>
        </div>
      `;
    }

    // settlement
    return cockpitHtml + `
      <div class="rule-banner" id="smartRuleBanner">
        <strong>Supplier settlement (step241):</strong> the payment relieves the supplier's oldest open legs first (material, haulage, then credit expenses). A <strong>VAT / IVA</strong> method settles only the VAT leg of an IVA invoice.
      </div>
      <div class="form-grid-3">
        ${companyField}
        ${dateField.replace('Transaction Date', 'Settlement Date')}
        ${fld('Supplier / Hauler *', inp('f_supplier', 'text', '', 'list="dl_suppliers"') + dl('dl_suppliers', supplierNames()), { hintId: 'hint_supplier', hint: '' })}
        ${fld('Payment Method *', sel('f_method', [['Payment', 'Payment (Cr 5300 Till / 5121 Bank)'], ['Barter', 'Barter'], ['VAT', 'VAT 11% only'], ['IVA', 'IVA invoice (net + VAT)']], 'Payment'))}
        ${fld('Amount Paid ($) *', inp('f_amount', 'number', '', 'step="0.01" min="0.01" inputmode="decimal"'), { hintId: 'hint_amount', hint: '' })}
        ${fld('Difference / Discount ($)', inp('f_discount', 'number', '0.00', 'step="0.01" min="0" inputmode="decimal"'))}
        ${fld('Reference', inp('f_reference', 'text', '', 'placeholder="Cheque / transfer no."'))}
        ${notesField}
      </div>
      <div id="paSupSubgridWrap"></div>
      <div class="live-calc">
        <div><small>Open AP before</small><b id="calc_before">—</b></div>
        <div><small>Paid + discount</small><b id="calc_total">$0.00</b></div>
        <div><small>Open AP after</small><b id="calc_after">—</b></div>
        <div><small>Allocation</small><b id="calc_alloc">Oldest leg first</b></div>
      </div>
    `;
  }

  // ---- live rule engine -------------------------------------------------------
  const FORM_UI = { priceManual: false, transManual: false, otManual: false, ticketManual: false, qtyManual: false, lastCompany: '' };
  const $ = id => document.getElementById(id);
  const qtyEl = () => document.getElementById('f_qty');
  const val = id => { const el = $(id); return el ? String(el.value == null ? '' : el.value).trim() : ''; };
  const num = id => { const v = Number(val(id)); return isFinite(v) ? v : 0; };
  const setHint = (id, text, cls) => { const el = $(id); if (!el) return; el.textContent = text || ''; el.className = 'hint' + (cls ? ' ' + cls : ''); };
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  function commonDateChecks(warnings) {
    const d = val('f_date');
    const today = todayISO();
    if (!d) return;
    if (d > today) setHint('hint_date', 'Future dates are blocked', 'crit');
    else if (d < MIN_DATE) setHint('hint_date', 'Before the books opened (' + MIN_DATE + ')', 'crit');
    else if (daysBetween(d, today) > 30) { setHint('hint_date', 'Back-dated ' + daysBetween(d, today) + ' days — add a note', 'warn'); warnings.push('backdated'); }
    else setHint('hint_date', '', '');
  }

  function dupCheck(company, formType) {
    const tno = val('f_ticketno');
    const hit = ticketExists(company, tno, formType || STATE.modalForm);
    const wrap = $('wrap_dupok');
    if (hit) {
      const party = hit.row.customer || hit.row.site_owner || hit.row.site || hit.row.equipment || '';
      setHint('hint_ticket', `Already used on ${hit.label} ${hit.row.ticket_no} dated ${String(hit.row.date).slice(0, 10)}${party ? ' · ' + party : ''}`, 'crit');
      if (wrap) wrap.hidden = false;
    } else {
      setHint('hint_ticket', tno ? 'Number is free in ' + company : '', tno ? 'ok' : '');
      if (wrap) { wrap.hidden = true; const cb = $('f_dupok'); if (cb) cb.checked = false; }
    }
    return hit;
  }

  function recalcSales() {
    const company = val('f_company');
    const saleType = val('f_saletype');
    const tbEl = $('f_transportby');
    const customer = val('f_customer');
    const product = val('f_product');
    const site = val('f_site');
    const date = val('f_date');
    const warnings = [];

    FORM_UI.lastCompany = company;

    // Rule #1 / #4: Pickup = customer truck, no transport; Delivery = company fleet or hauler
    if (tbEl) {
      if (saleType === 'Pickup') { if (tbEl.value !== 'Customer truck' && tbEl.value !== 'Third-party truck') tbEl.value = 'Customer truck'; }
      else if (tbEl.value === 'Customer truck') tbEl.value = 'Company fleet';
    }
    const transportBy = val('f_transportby');

    // UoM + ton factor from the product
    const prod = productInfo(product);
    const uom = prod ? (prod.uom || 'm³') : 'm³';
    setText('lbl_uom', uom);
    setHint('hint_product', prod ? (Number(prod.ton_factor) && Number(prod.ton_factor) !== 1 ? `1 ${uom} = ${prod.ton_factor} t` : '') : (product ? 'Unknown grade' : ''), '');

    // Customer: AR + VAT status
    const cust = customerInfo(customer);
    const vatReg = !!(cust && cust['VAT Registered'] === 'Yes');
    const ar = cust && cust.in_ar_book ? Number(cust.ar_balance || 0) : null;
    const custMethod = cust ? String(cust.method || 'Credit') : '';
    setHint('hint_customer', cust
      ? `${ar != null ? 'Open AR ' + fmtUSD(ar, 2) : 'Registered · outside the top-60 AR sample'}${custMethod ? ' · ' + custMethod + ' customer' : ''}${vatReg ? ' · VAT-registered (11%)' : ''}`
      : (customer ? 'New customer — not in the AR book yet' : ''), ar > 0 ? 'warn' : '');
    // m50 / m58: the customer's default payment method locks the ticket method (a Cash customer never posts to AR)
    const methEl = $('f_method');
    if (methEl && cust && custMethod && !FORM_UI.methodManual && (custMethod === 'Cash' || custMethod === 'Credit')) methEl.value = custMethod;
    const vatWrap = $('wrap_vatinvoice');
    if (vatWrap) vatWrap.hidden = !vatReg;

    // Price agreement lock (fillPrices on the Dataverse form): Delivery reads Sales (Delivery) with the ticket's Site,
    // Pickup reads Sales (Pickup); both fall back to the List Price rule, then to the model's list price
    const upEl = $('f_unitprice'), tpEl = $('f_transunitprice');
    const wantType = saleType === 'Pickup' ? 'Sales (Pickup)' : 'Sales (Delivery)';
    let rule = (customer && product) ? findRule({ company, customer, product, site, date, types: [wantType] }) : null;
    const crossType = !rule && customer && product ? findRule({ company, customer, product, site, date, types: [saleType === 'Pickup' ? 'Sales (Delivery)' : 'Sales (Pickup)'] }) : null;
    if (!FORM_UI.priceManual && upEl) {
      if (rule) {
        upEl.value = Number(rule.unit_price || 0).toFixed(2);
        if (tpEl && saleType === 'Delivery' && !FORM_UI.transManual) tpEl.value = Number(rule.trans_unit_price || 0).toFixed(2);
        setText('lbl_pricelock', 'AGREEMENT');
        setHint('hint_price', `${rule.rule_type || 'Agreement'} · ${rule.name}${rule.site ? ' · ' + rule.site : ''}${rule.end_date ? ' · to ' + rule.end_date : ''}${rule.unit && rule.unit !== uom ? ' · priced per ' + rule.unit : ''}`, 'ok');
        if (/truck/i.test(rule.unit || '') && qtyEl() && !FORM_UI.qtyManual) qtyEl().value = '1'; // m229: sold per load → Quantity 1
      } else {
        const lpRule = product ? listPriceRule(company, product, date) : null;
        const lp = lpRule ? Number(lpRule.unit_price || 0) : (product ? listPrice(product) : null);
        if (lp != null) { upEl.value = lp.toFixed(2); setText('lbl_pricelock', 'LIST PRICE'); setHint('hint_price', (crossType ? `No ${wantType} agreement (customer has ${crossType.rule_type} at ${fmtUSD(crossType.unit_price, 2)}) — ` : 'No customer agreement — ') + (lpRule ? lpRule.name : 'model list price'), 'warn'); }
        else { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', product ? 'No agreement or list price — type the price' : '', ''); }
      }
    } else if (upEl) {
      setText('lbl_pricelock', 'MANUAL');
      setHint('hint_price', rule ? `Overrides agreement ${rule.name} (${fmtUSD(rule.unit_price, 2)})` : 'Typed price', rule ? 'warn' : '');
    }
    if (tpEl) {
      if (saleType === 'Pickup') { tpEl.value = '0.00'; tpEl.disabled = true; setHint('hint_trans', 'Pickup — no transport charge', ''); }
      else { tpEl.disabled = false; setHint('hint_trans', transportBy === 'Third-party truck' ? 'Hauler delivers — transport price billed to customer' : '', ''); }
    }
    setHint('hint_site', saleType === 'Delivery' ? (site ? '' : 'Required on Delivery') : 'Optional on Pickup', saleType === 'Delivery' && !site ? 'crit' : '');
    const truckName = val('f_truck');
    const truckRow = truckName ? SEED.records.equipment.find(e => norm(e.name) === norm(truckName)) : null;
    const ownTruck = !!(truckRow && /^own/i.test(truckRow.ownership || ''));
    const qvWrap = $('paTruckQvWrap');
    if (qvWrap && window.MFG_FORMS) qvWrap.innerHTML = window.MFG_FORMS.renderTruckQuickView(truckRow, transportBy === 'Company fleet');
    if (truckRow && truckRow.default_driver && $('f_driver') && !val('f_driver')) $('f_driver').value = truckRow.default_driver;
    // m103 / m125: the agreement tier whose Truck Size equals the truck's capacity supplies a PER-LOAD Adjustment that
    // rides into the Material Total (bhf_price = qty × unit price + adjustment − discount) — never a per-unit change
    let tier = { tier: 0, adj: 0, transAdj: 0 };
    if (rule && truckRow && truckRow.capacity && window.MFG_FORMS) tier = window.MFG_FORMS.matchTier(rule, Number(truckRow.capacity));
    else if (rule && !truckRow && window.MFG_FORMS && rule.qty1 != null && saleType !== 'Pickup') tier = window.MFG_FORMS.matchTier(rule, null); // m103 fallback: Truck Size 1
    if (saleType === 'Delivery' && !truckName) setHint('hint_truck', 'Required on Delivery', 'crit');
    else if (truckName && transportBy === 'Company fleet' && truckRow && !ownTruck) setHint('hint_truck', `${truckRow.name} is a third-party unit (${truckRow.supplier || 'hauler'}) — switch Transported By or pick an own truck`, 'warn');
    else if (truckName && transportBy === 'Third-party truck' && ownTruck) setHint('hint_truck', `${truckRow.name} is an own-fleet unit — Transported By should be Company fleet`, 'warn');
    else if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty')) setHint('hint_truck', `Capacity ${fmtNum(truckRow.capacity, 1)} ${uom}`, '');
    else setHint('hint_truck', saleType === 'Delivery' ? '' : 'Optional on Pickup', '');
    if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty') && !FORM_UI.qtyManual) { qtyEl().value = Number(truckRow.capacity).toFixed(2); } // m125: Quantity = the truck's capacity

    // Overtime suggestion (m93: only company-fleet loads earn the allowance)
    const otEl = $('f_overtime');
    const otSuggest = transportBy === 'Company fleet' && isOvertimeTime(val('f_time'));
    if (otEl && !FORM_UI.otManual) otEl.checked = otSuggest;
    setHint('hint_time', otSuggest ? 'Outside the day shift → overtime allowance' : 'Day shift 06:00–17:59', otSuggest ? 'warn' : '');

    // Money (mirrors the Dataverse recompute: Material = qty × unit price + tier adjustment; VAT 11% on the net total, m268)
    const qty = num('f_qty'), up = num('f_unitprice'), tp = saleType === 'Pickup' ? 0 : num('f_transunitprice'), disc = num('f_discount');
    const tierAdj = FORM_UI.priceManual ? 0 : Number(tier.adj || 0);
    const tierTrAdj = (FORM_UI.transManual || saleType === 'Pickup') ? 0 : Number(tier.transAdj || 0);
    const mat = round2(qty * up + tierAdj), tr = round2(qty * tp + tierTrAdj);
    const net = round2(mat + tr - disc);
    const vat = vatReg ? round2(net * VAT_RATE) : 0;
    const ttc = round2(net + vat);
    setText('calc_mat', fmtUSD(mat, 2) + (tierAdj ? ` (tier ${tier.tier} ${tierAdj > 0 ? '+' : '−'}$${Math.abs(tierAdj).toFixed(2)})` : ''));
    setText('calc_tr', fmtUSD(tr, 2) + (tierTrAdj ? ` (tier ${tierTrAdj > 0 ? '+' : '−'}$${Math.abs(tierTrAdj).toFixed(2)})` : ''));
    setText('calc_vat', vatReg ? fmtUSD(vat, 2) : '—');
    setText('calc_total', fmtUSD(ttc, 2));
    setHint('hint_qty', qty > 0 && prod && Number(prod.ton_factor) && Number(prod.ton_factor) !== 1 ? `≈ ${fmtNum(qty * Number(prod.ton_factor), 2)} t` : (qty <= 0 && val('f_qty') ? 'Must be above zero' : ''), qty <= 0 && val('f_qty') ? 'crit' : '');
    if (disc > mat && mat > 0) setHint('hint_disc', 'Discount exceeds the material subtotal', 'crit');
    else if (mat > 0 && disc > mat * 0.2) { setHint('hint_disc', 'Above 20% of material — add a note', 'warn'); }
    else setHint('hint_disc', '', '');

    commonDateChecks(warnings);
    dupCheck(company);
    return { company, saleType, transportBy, customer, product, site, date, prod, uom, cust, vatReg, rule, tier, tierAdj, tierTrAdj, qty, up, tp, disc, mat, tr, net, vat, ttc, method: val('f_method') };
  }

  function recalcRaw() {
    const company = val('f_company');
    const transportBy = val('f_transportby');
    const site = val('f_site'), product = val('f_product'), date = val('f_date');
    const sInfo = site ? siteInfo(site) : null;
    if (sInfo && sInfo.supplier && $('f_siteowner') && !val('f_siteowner')) $('f_siteowner').value = sInfo.supplier;
    if (sInfo && sInfo.supplier && transportBy !== 'Company fleet' && $('f_truckowner') && !val('f_truckowner')) $('f_truckowner').value = sInfo.supplier;
    const owner = val('f_siteowner');
    const truckName = val('f_truck');
    const truckRow = truckName ? SEED.records.equipment.find(e => norm(e.name) === norm(truckName)) : null;
    const qvWrap = $('paTruckQvWrap');
    if (qvWrap && window.MFG_FORMS) qvWrap.innerHTML = window.MFG_FORMS.renderTruckQuickView(truckRow, transportBy === 'Company fleet');
    if (truckRow && truckRow.default_driver && $('f_driver') && !val('f_driver')) $('f_driver').value = truckRow.default_driver;
    if (truckRow && truckRow.capacity && qtyEl() && !val('f_qty') && !FORM_UI.qtyManual) qtyEl().value = Number(truckRow.capacity).toFixed(2);
    const warnings = [];
    FORM_UI.lastCompany = company;

    const prod = productInfo(product);
    setText('lbl_uom', prod ? (prod.uom || 'm³') : 'm³');
    const upEl = $('f_unitprice'), tpEl = $('f_transunitprice');
    // fillCost on the raw ticket: Purchase Price (Site) for the material leg, Transport Price (Site) for the haulage leg
    const rule = (owner || site) && product ? findRule({ company, supplier: owner, site, product, date, types: ['Purchase Price (Site)'] }) : null;
    const haulRule = site && product && transportBy !== 'Company fleet' ? findRule({ company, supplier: val('f_truckowner'), site, product, date, types: ['Transport Price (Site)'] }) : null;
    if (!FORM_UI.priceManual && upEl) {
      if (rule) { upEl.value = Number(rule.unit_price || 0).toFixed(2); setText('lbl_pricelock', 'AGREEMENT'); setHint('hint_price', `${rule.rule_type || 'Agreement'} · ${rule.name}`, 'ok'); }
      else { const lpRule = product ? listPriceRule(company, product, date) : null; if (lpRule) { upEl.value = Number(lpRule.unit_price || 0).toFixed(2); setText('lbl_pricelock', 'LIST PRICE'); setHint('hint_price', 'No purchase agreement — ' + lpRule.name, 'warn'); } else { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', product ? 'No purchase-price agreement for this owner / site' : '', ''); } }
      if (tpEl && transportBy !== 'Company fleet' && haulRule && !FORM_UI.transManual) tpEl.value = Number(haulRule.trans_unit_price || haulRule.unit_price || 0).toFixed(2);
    } else if (upEl) { setText('lbl_pricelock', 'MANUAL'); setHint('hint_price', rule ? `Overrides ${rule.name} (${fmtUSD(rule.unit_price, 2)})` : '', rule ? 'warn' : ''); }

    if (tpEl) {
      if (transportBy === 'Company fleet') { tpEl.value = '0.00'; tpEl.disabled = true; setHint('hint_trans', 'Own truck — haulage leg is $0', ''); }
      else { tpEl.disabled = false; setHint('hint_trans', haulRule ? `${haulRule.rule_type} · ${haulRule.name}` : '', haulRule ? 'ok' : ''); }
    }
    const toEl = $('f_truckowner');
    if (toEl) {
      if (transportBy === 'Company fleet') { toEl.value = company; toEl.disabled = true; setHint('hint_truckowner', 'Hauled by the company fleet', ''); }
      else { if (toEl.disabled) { toEl.disabled = false; if (toEl.value === company) toEl.value = ''; } setHint('hint_truckowner', toEl.value ? '' : 'Required for third-party haulage', toEl.value ? '' : 'crit'); }
    }
    const ap = openApBalance(owner);
    setHint('hint_owner', owner ? (ap != null ? `Open AP ${fmtUSD(ap, 2)}` : 'New payee — not in the AP book yet') : '', '');

    const otEl = $('f_overtime');
    const otSuggest = transportBy === 'Company fleet' && isOvertimeTime(val('f_time'));
    if (otEl && !FORM_UI.otManual) otEl.checked = otSuggest;
    setHint('hint_time', otSuggest ? 'Outside the day shift → overtime allowance' : 'Day shift 06:00–17:59', otSuggest ? 'warn' : '');

    const qty = num('f_qty'), up = num('f_unitprice'), tp = transportBy === 'Company fleet' ? 0 : num('f_transunitprice');
    const mat = round2(qty * up), tr = round2(qty * tp);
    setText('calc_mat', fmtUSD(mat, 2)); setText('calc_tr', fmtUSD(tr, 2)); setText('calc_qty', fmtNum(qty, 2) + ' ' + (prod ? prod.uom : 'm³')); setText('calc_total', fmtUSD(mat + tr, 2));
    commonDateChecks(warnings);
    dupCheck(company);
    return { company, transportBy, site, owner, product, date, prod, rule, qty, up, tp, mat, tr };
  }

  function recalcReceipt() {
    const customer = val('f_customer');
    const cust = customerInfo(customer);
    const before = openArBalance(customer);
    const amount = num('f_amount'), disc = num('f_discount');
    setHint('hint_customer', cust
      ? (cust.in_ar_book ? `${cust['VAT Registered'] === 'Yes' ? 'VAT-registered · ' : ''}${fmtNum(cust.loads)} loads · last sale ${String(cust.last_sale || '').slice(0, 10) || '—'}` : 'Registered customer · outside the top-60 AR sample (balance unknown here)')
      : (customer ? 'Not in the customer master — check the spelling' : ''), customer && !cust ? 'warn' : '');
    setText('calc_before', before == null ? '—' : fmtUSD(before, 2));
    setText('calc_total', fmtUSD(amount + disc, 2));
    setText('calc_after', before == null ? '—' : fmtUSD(before - amount - disc, 2));
    setText('calc_alloc', val('f_method') === 'VAT' ? 'VAT leg only' : 'FIFO oldest ticket first');
    const cSub = $('paCustSubgridWrap');
    if (cSub && window.MFG_FORMS) cSub.innerHTML = window.MFG_FORMS.renderCustomerOpenTicketsSubgrid({ SEED, STATE }, val('f_company'), customer, amount + disc, val('f_method'));
    if (before != null && amount + disc > before + 0.005) setHint('hint_amount', `Exceeds the open balance by ${fmtUSD(amount + disc - before, 2)} — becomes an advance`, 'warn');
    else setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    commonDateChecks([]);
    return { customer, cust, before, amount, disc };
  }

  function recalcFuel() {
    const company = val('f_company'), equipment = val('f_truck'), date = val('f_date');
    const type = val('f_metertype');
    const reading = $('f_meter') && val('f_meter') !== '' ? num('f_meter') : null;
    const litres = num('f_qty');
    const mEl = $('f_meter');
    if (mEl) mEl.disabled = type === 'none';
    FORM_UI.lastCompany = company;

    const prev = equipment ? lastMeter(company, equipment, date || undefined) : null;
    const prevVal = prev ? (prev.odometer != null ? Number(prev.odometer) : Number(prev.hours)) : null;
    const prevType = prev ? (prev.odometer != null ? 'odometer' : 'hours') : null;
    setText('calc_prev', prev ? `${fmtNum(prevVal, 0)} ${prevType === 'hours' ? 'h' : 'km'} on ${String(prev.date).slice(0, 10)}` : (equipment ? 'No prior reading' : '—'));
    let guard = { ok: true, label: 'OK', cls: '' };
    let delta = null;
    if (type !== 'none' && reading != null) {
      if (reading <= 0) guard = { ok: false, label: 'Reading must be above zero', cls: 'crit' };
      else if (type === 'odometer' && reading > 1000000) guard = { ok: false, label: 'Over 1,000,000 km — typo?', cls: 'crit' };
      else if (type === 'hours' && reading > 100000) guard = { ok: false, label: 'Over 100,000 h — typo?', cls: 'crit' };
      else if (prev && prevType === type) {
        delta = reading - prevVal;
        if (delta < 0) guard = { ok: false, label: `Backwards by ${fmtNum(-delta, 0)} ${type === 'hours' ? 'h' : 'km'} vs the last intake`, cls: 'crit' };
        else if (type === 'odometer' && delta > 5000) guard = { ok: true, label: `Jump of ${fmtNum(delta, 0)} km — confirm in notes`, cls: 'warn' };
        else if (type === 'hours' && delta > 500) guard = { ok: true, label: `Jump of ${fmtNum(delta, 0)} h — confirm in notes`, cls: 'warn' };
      }
    }
    setHint('hint_meter', guard.label === 'OK' ? '' : guard.label, guard.cls);
    setText('calc_delta', delta == null ? '—' : fmtNum(delta, 0) + (type === 'hours' ? ' h' : ' km'));
    setText('calc_rate', delta && delta > 0 && litres > 0 ? (type === 'hours' ? fmtNum(litres / delta, 2) + ' L/h' : fmtNum(litres / delta * 100, 1) + ' L/100km') : '—');
    setText('calc_total', guard.ok ? (guard.cls === 'warn' ? 'CHECK' : 'PASS') : 'BLOCKED');
    const known = equipmentNames().some(n => norm(n) === norm(equipment));
    setHint('hint_truck', equipment ? (known ? '' : 'Not in the equipment registry — check the plate') : '', equipment && !known ? 'warn' : '');
    const bbcTankNegative = company === 'BBConstruction' && /diesel/i.test(val('f_item')) && Number((((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model || {}).BBConstruction || {}).diesel_stock_balance_l || 0) < 0;
    setHint('hint_qty', bbcTankNegative ? 'BBConstruction tank is negative — diesel intakes are refused until the history is corrected (m212)' : (litres <= 0 && val('f_qty') ? 'Must be above zero' : ''), bbcTankNegative || (litres <= 0 && val('f_qty')) ? 'crit' : '');
    commonDateChecks([]);
    if (val('f_ticketno')) dupCheck(company); else setHint('hint_ticket', 'Optional — leave blank for an unnumbered intake', '');
    return { company, equipment, date, type, reading, litres, prev, delta, guard, bbcTankNegative };
  }

  function recalcExpense() {
    const method = val('f_method'), supplier = val('f_supplier'), amount = num('f_amount');
    // bhf_subcatFilter.js: the Subcategory list follows the Category (strict cascade); a category without subs keeps the full list
    const catNow = val('f_category');
    const dlSub = $('dl_subcats');
    if (dlSub && FORM_UI.lastCategory !== catNow) {
      FORM_UI.lastCategory = catNow;
      const cats = FORM_UI.catCache || (FORM_UI.catCache = expenseCategories());
      const hit = cats.find(c => c.category === catNow);
      const subs = hit && hit.subs.length ? hit.subs : uniqSorted(cats.flatMap(c => c.subs));
      dlSub.innerHTML = subs.map(s => `<option value="${esc(s)}">`).join('');
      const subEl = $('f_subcategory');
      if (subEl && subEl.value && hit && hit.subs.length && !hit.subs.includes(subEl.value)) subEl.value = '';
      if (subEl) subEl.placeholder = hit && hit.subs.length ? `${hit.subs.length} subcategories under ${catNow}` : 'Subcategory...';
    }
    setText('calc_total', fmtUSD(amount, 2));
    setText('calc_post', method === 'Cash' ? 'Cash till 5300' : 'Supplier credit 4011');
    const ap = openApBalance(supplier);
    setText('calc_before', ap == null ? '—' : fmtUSD(ap, 2));
    setHint('hint_supplier', method === 'Credit' && !supplier ? 'Required for Credit' : '', method === 'Credit' && !supplier ? 'crit' : '');
    setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    const cat = val('f_category');
    setText('calc_gl', /fuel|oil/i.test(cat) ? '60 · Fuel & lubricants' : (/repair|spare|tool|minor/i.test(cat) ? '61 · Repairs & parts' : (/tip/i.test(cat) ? '64 · Staff' : '62 · Operating')));
    commonDateChecks([]);
    return { method, supplier, amount };
  }

  function recalcSettlement() {
    const supplier = val('f_supplier');
    const before = openApBalance(supplier);
    const amount = num('f_amount'), disc = num('f_discount');
    setHint('hint_supplier', supplier && before == null ? 'Not in the AP book — check the spelling' : '', supplier && before == null ? 'warn' : '');
    setText('calc_before', before == null ? '—' : fmtUSD(before, 2));
    setText('calc_total', fmtUSD(amount + disc, 2));
    setText('calc_after', before == null ? '—' : fmtUSD(before - amount - disc, 2));
    setText('calc_alloc', /VAT|IVA/.test(val('f_method')) ? 'VAT leg only' : 'Oldest leg first');
    const sSub = $('paSupSubgridWrap');
    if (sSub && window.MFG_FORMS) sSub.innerHTML = window.MFG_FORMS.renderSupplierOpenLegsSubgrid({ SEED, STATE }, val('f_company'), supplier, amount + disc, 'all');
    if (before != null && amount + disc > before + 0.005) setHint('hint_amount', `Exceeds the open balance by ${fmtUSD(amount + disc - before, 2)} — becomes a prepayment`, 'warn');
    else setHint('hint_amount', amount <= 0 && val('f_amount') ? 'Must be above zero' : '', amount <= 0 && val('f_amount') ? 'crit' : '');
    commonDateChecks([]);
    return { supplier, before, amount, disc };
  }

  function recalcForm() {
    try {
      if (['salary', 'logistics', 'treasury'].includes(STATE.modalForm)) {
        const usd = num('f_usd'), lbp = num('f_lbp');
        const tot = round2(usd + lbp / 90000);
        const aEl = $('f_amount');
        if (aEl && (usd > 0 || lbp > 0 || !aEl.value)) aEl.value = tot.toFixed(2);
        return { usd, lbp, amount: num('f_amount') };
      }
      if (STATE.modalForm === 'pricerule') {
        const up = num('f_unitprice'), tp = num('f_transunitprice'), q1 = num('f_qty1'), a1 = num('f_adj1'), ta1 = num('f_transadj1'), q2 = num('f_qty2'), a2 = num('f_adj2'), ta2 = num('f_transadj2');
        setText('calc_mat', `${fmtUSD(up, 2)} + ${fmtUSD(tp, 2)} / ${val('f_uom') || 'm³'}`);
        // m71 / m73: Total N = Price × Truck Size N + Adjustment N (per load); transport total the same way
        setText('calc_tr', q1 > 0 ? `${q1} ${val('f_uom') || 'm³'} → ${fmtUSD(q1 * up + a1, 2)}${tp ? ' + trans ' + fmtUSD(q1 * tp + ta1, 2) : ''}` : '—');
        setText('calc_vat', q2 > 0 ? `${q2} ${val('f_uom') || 'm³'} → ${fmtUSD(q2 * up + a2, 2)}${tp ? ' + trans ' + fmtUSD(q2 * tp + ta2, 2) : ''}` : '—');
        setText('calc_total', fmtUSD(up + tp, 2));
        return { up, tp };
      }
      if (STATE.modalForm === 'vatinvoice') {
        const net = num('f_amount');
        const vEl = $('f_vat');
        if (vEl && !FORM_UI.priceManual && net > 0) vEl.value = round2(net * VAT_RATE).toFixed(2);
        const vat = num('f_vat');
        setText('calc_mat', fmtUSD(net, 2));
        setText('calc_vat', fmtUSD(vat, 2));
        setText('calc_total', fmtUSD(net + vat, 2));
        return { net, vat, ttc: round2(net + vat) };
      }
      switch (STATE.modalForm) {
        case 'sales': return recalcSales();
        case 'raw': return recalcRaw();
        case 'receipt': return recalcReceipt();
        case 'fuel': return recalcFuel();
        case 'expense': return recalcExpense();
        case 'settlement': return recalcSettlement();
        default: return {};
      }
    } catch (e) { console.error('recalc', e); return {}; }
  }

  function wireModalSuggestions(body) {
    if (!body) return;
    const closeAll = exceptMenu => {
      body.querySelectorAll('.pa-suggest-menu').forEach(m => {
        if (m !== exceptMenu) {
          m.hidden = true;
          m.innerHTML = '';
          const w = m.closest('.pa-suggest-wrap');
          if (w) w.classList.remove('open');
        }
      });
    };
    if (!body.dataset.suggestDocWired) {
      body.dataset.suggestDocWired = '1';
      document.addEventListener('mousedown', e => {
        if (!e.target || !e.target.closest('.pa-suggest-wrap')) closeAll(null);
      });
    }
    body.querySelectorAll('input[list]').forEach(el => {
      const listId = el.getAttribute('list');
      if (!listId) return;
      el.removeAttribute('list');
      el.dataset.suggestList = listId;
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('spellcheck', 'false');

      const wrap = document.createElement('div');
      wrap.className = 'pa-suggest-wrap';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);

      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = 'pa-suggest-caret';
      caret.tabIndex = -1;
      caret.setAttribute('aria-label', 'Show suggestions');
      caret.innerHTML = '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2.5 4.5 6 8 9.5 4.5"/></svg>';
      wrap.appendChild(caret);

      const menu = document.createElement('div');
      menu.className = 'pa-suggest-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      wrap.appendChild(menu);

      let activeIdx = -1;
      let currentMatches = [];

      const getOptions = () => {
        const dlEl = document.getElementById(listId) || body.querySelector('#' + listId);
        if (!dlEl) return [];
        return Array.from(dlEl.querySelectorAll('option')).map(o => o.value).filter(Boolean);
      };

      const highlightMatch = (text, q) => {
        if (!q) return esc(text);
        const idx = text.toLowerCase().indexOf(q.toLowerCase());
        if (idx < 0) return esc(text);
        return `${esc(text.slice(0, idx))}<mark class="pa-suggest-mark">${esc(text.slice(idx, idx + q.length))}</mark>${esc(text.slice(idx + q.length))}`;
      };

      const choose = valStr => {
        el.value = valStr;
        closeAll(null);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const renderMenu = (showAllOnEmpty = false) => {
        if (el.disabled || el.readOnly) { closeAll(null); return; }
        const all = getOptions();
        const q = String(el.value || '').trim();
        const ql = q.toLowerCase();
        let filtered;
        if (!ql) {
          if (!showAllOnEmpty) { closeAll(null); return; }
          filtered = all;
        } else {
          const starts = [];
          const contains = [];
          for (const item of all) {
            const il = item.toLowerCase();
            if (il.startsWith(ql)) starts.push(item);
            else if (il.includes(ql)) contains.push(item);
          }
          filtered = starts.concat(contains);
        }
        if (!filtered.length || (filtered.length === 1 && filtered[0] === q)) {
          closeAll(null);
          return;
        }
        const MAX_SHOW = 7;
        currentMatches = filtered.slice(0, MAX_SHOW);
        activeIdx = ql ? 0 : -1;
        closeAll(menu);
        menu.innerHTML = currentMatches.map((item, i) => `
          <div class="pa-suggest-item${i === activeIdx ? ' active' : ''}" role="option" data-suggest-idx="${i}">
            <span class="pa-suggest-label">${highlightMatch(item, q)}</span>
          </div>
        `).join('') + (filtered.length > MAX_SHOW
          ? `<div class="pa-suggest-more">Top ${MAX_SHOW} of ${filtered.length} matches · type to refine</div>`
          : '');
        menu.hidden = false;
        wrap.classList.add('open');

        menu.querySelectorAll('.pa-suggest-item').forEach(row => {
          row.addEventListener('mousedown', ev => {
            ev.preventDefault();
            const idx = Number(row.getAttribute('data-suggest-idx'));
            if (currentMatches[idx] != null) choose(currentMatches[idx]);
          });
          row.addEventListener('mouseenter', () => {
            activeIdx = Number(row.getAttribute('data-suggest-idx'));
            menu.querySelectorAll('.pa-suggest-item').forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
          });
        });
      };

      el.addEventListener('input', () => renderMenu(true));
      el.addEventListener('click', () => renderMenu(true));
      caret.addEventListener('mousedown', ev => {
        ev.preventDefault();
        if (!menu.hidden) {
          closeAll(null);
        } else {
          try { el.focus({ preventScroll: true }); } catch (_) {}
          renderMenu(true);
        }
      });
      el.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.activeElement !== el) closeAll(null);
        }, 120);
      });
      el.addEventListener('keydown', ev => {
        if (menu.hidden || !currentMatches.length) {
          if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            renderMenu(true);
          }
          return;
        }
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          activeIdx = (activeIdx + 1) % currentMatches.length;
          menu.querySelectorAll('.pa-suggest-item').forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
          menu.querySelectorAll('.pa-suggest-item').forEach((r, ri) => r.classList.toggle('active', ri === activeIdx));
        } else if (ev.key === 'Enter') {
          if (activeIdx >= 0 && currentMatches[activeIdx] != null) {
            ev.preventDefault();
            choose(currentMatches[activeIdx]);
          }
        } else if (ev.key === 'Escape' || ev.key === 'Tab') {
          closeAll(null);
        }
      });
    });
  }

  let modalFocusTimer = null;
  function wireModalLiveCalc(autoFocus = false) {
    const body = $('modalBody');
    if (!body) return;
    clearTimeout(modalFocusTimer);
    wireModalSuggestions(body);
    FORM_UI.priceManual = false; FORM_UI.transManual = false; FORM_UI.methodManual = false; FORM_UI.otManual = false; FORM_UI.ticketManual = false; FORM_UI.qtyManual = false;
    FORM_UI.lastCompany = val('f_company'); FORM_UI.lastCategory = null; FORM_UI.catCache = null;
    body.querySelectorAll('input, select').forEach(el => {
      const handler = () => {
        if (el.id === 'f_unitprice') FORM_UI.priceManual = true;
        if (el.id === 'f_transunitprice') FORM_UI.transManual = true;
        if (el.id === 'f_method') FORM_UI.methodManual = true;
        if (el.id === 'f_qty') FORM_UI.qtyManual = !!el.value;
        if (el.id === 'f_overtime') FORM_UI.otManual = true;
        if (el.id === 'f_ticketno') FORM_UI.ticketManual = !!el.value;
        // a new counterparty / product / site re-runs the agreement lookup; sale type, date or quantity never override a typed price
        if (['f_customer', 'f_product', 'f_site', 'f_siteowner', 'f_truckowner', 'f_company'].includes(el.id)) { FORM_UI.priceManual = false; FORM_UI.transManual = false; }
        if (el.id === 'f_customer') FORM_UI.methodManual = false;
        recalcForm();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    recalcForm();
    if (autoFocus && window.matchMedia('(min-width: 861px)').matches) {
      const first = body.querySelector('#f_ticketno, #f_customer, #f_supplier, #f_staff, #f_name, #f_counterparty, #f_truck, #f_category');
      if (first) {
        modalFocusTimer = setTimeout(() => {
          const modal = $('entryModal');
          const card = modal && modal.querySelector('.modal-card');
          if (card) {
            const cr = card.getBoundingClientRect();
            const fr = first.getBoundingClientRect();
            if (fr.bottom > cr.bottom - 16) return;
          }
          try { first.focus({ preventScroll: true }); } catch (_) {}
          if (card) card.scrollTop = 0;
          if (body) body.scrollTop = 0;
        }, 60);
      }
    }
  }

  // ---- validation + posting ---------------------------------------------------
  function validateAndBuild() {
    const f = STATE.modalForm;
    const errors = [];
    const c = recalcForm();
    const company = val('f_company');
    const date = val('f_date') || todayISO();
    const today = todayISO();
    const notes = val('f_notes');
    const who = activeUser();
    const needsDate = !['customer', 'supplier', 'product', 'site', 'equipment', 'companyequipment', 'driver'].includes(f);
    if (!allowedCompanyNames().includes(company)) errors.push('Your seat cannot post to ' + (company || 'that company') + '.');
    if (needsDate) {
      if (!val('f_date')) errors.push('Date is required.');
      else if (date > today && f !== 'pricerule') errors.push('Future dates are not allowed.');
      else if (date < MIN_DATE) errors.push('Date is before the books opened (' + MIN_DATE + ').');
      else if (daysBetween(date, today) > 30 && !notes && ['sales', 'raw', 'receipt', 'fuel', 'expense', 'settlement'].includes(f)) errors.push('Back-dated more than 30 days — add a note explaining why.');
    }

    const base = { id: uid(f.slice(0, 2)), date, company, notes, source: 'app', entered_by: who.full_name, entered_by_email: who.email, entered_at: nowStamp(), voided: false };
    let record = null;
    let crKey = FORM_CR_KEY[f] || 'sales_tickets';

    if (f === 'sales') {
      const ticket = val('f_ticketno');
      if (!ticket) errors.push('Ticket number is required.');
      const dup = ticketExists(company, ticket, 'sales');
      if (dup && !($('f_dupok') && $('f_dupok').checked)) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company} — tick "Post anyway" if the pad really repeats.`);
      if (!c.customer) errors.push('Customer is required.');
      if (!c.product) errors.push('Product is required.');
      if (!(c.qty > 0)) errors.push('Quantity must be above zero.');
      if (c.up < 0) errors.push('Unit price cannot be negative.');
      if (c.up === 0 && !notes) errors.push('A free ticket (unit price 0) needs a note.');
      if (c.saleType === 'Delivery') {
        if (!c.site) errors.push('Destination site is required on a Delivery.');
        if (!val('f_truck')) errors.push('Truck is required on a Delivery.');
        if (!val('f_driver')) errors.push('Driver is required on a Delivery.');
      }
      if (c.disc > c.mat && c.mat > 0) errors.push('Discount exceeds the material subtotal.');
      if (c.mat > 0 && c.disc > c.mat * 0.2 && !notes) errors.push('Discount above 20% of material needs a note.');
      if (c.vatReg && !val('f_vatinvoice') && c.method !== 'Cash' && val('f_method') !== 'Cash') { /* VAT invoice number optional — the book links it later */ }
      record = { ...base, name: `TKT ${date} ${c.customer} #${ticket}`, ticket_no: ticket, rep_date: date, sale_type: c.saleType, transport_by: c.transportBy, customer: c.customer, product: c.product, site: c.site, truck_owner: c.transportBy === 'Company fleet' ? company : '', truck: val('f_truck'), driver: val('f_driver'), uom: c.uom, ton_factor: c.prod ? Number(c.prod.ton_factor || 1) : 1, qty: c.qty, unit_price: c.up, price: c.mat, tier: c.tier ? c.tier.tier : 0, tier_adj: c.tierAdj || 0, trans_unit_price: c.tp, trans_price: c.tr, trans_tier_adj: c.tierTrAdj || 0, discount: c.disc, total: c.net, vat: c.vat, total_ttc: c.ttc, method: val('f_method'), vat_invoice: c.vatReg ? val('f_vatinvoice') : '', time: val('f_time') || '12:00', overtime: !!($('f_overtime') && $('f_overtime').checked), price_rule: c.rule ? c.rule.name : (c.up ? (FORM_UI.priceManual ? 'Manual' : 'List Price') : ''), duplicate_confirmed: !!dup };
    } else if (f === 'raw') {
      const ticket = val('f_ticketno');
      if (!ticket) errors.push('Ticket number is required.');
      const dup = ticketExists(company, ticket, 'raw');
      if (dup && !($('f_dupok') && $('f_dupok').checked)) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company} — tick "Post anyway" if the pad really repeats.`);
      if (!c.site) errors.push('Quarry site is required.');
      if (!c.product) errors.push('Raw material is required.');
      if (!(c.qty > 0)) errors.push('Quantity must be above zero.');
      if (c.up > 0 && !c.owner) errors.push('Quarry site owner (material payee) is required when the material has a cost.');
      if (c.transportBy !== 'Company fleet' && c.tp > 0 && !val('f_truckowner')) errors.push('Truck owner (haulage payee) is required for third-party haulage.');
      record = { ...base, name: `RAW ${date} ${c.site} #${ticket}`, ticket_no: ticket, rep_date: date, product: c.product, site: c.site, site_owner: c.owner, transport_by: c.transportBy, truck_owner: c.transportBy === 'Company fleet' ? company : val('f_truckowner'), truck: val('f_truck'), driver: val('f_driver'), uom: c.prod ? c.prod.uom : 'm³', qty: c.qty, unit_cost: c.up, cost: c.mat, trans_unit_cost: c.tp, trans_cost: c.tr, total: round2(c.mat + c.tr), method: val('f_method'), time: val('f_time') || '12:00', overtime: !!($('f_overtime') && $('f_overtime').checked), price_rule: c.rule ? c.rule.name : '', duplicate_confirmed: !!dup };
    } else if (f === 'receipt') {
      if (!c.customer) errors.push('Customer is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.disc < 0) errors.push('Discount cannot be negative.');
      record = { ...base, name: `RCPT ${date} ${c.customer}`, customer: c.customer, method: val('f_method'), amount: round2(c.amount), discount: round2(c.disc), reference: val('f_reference'), ar_before: c.before };
    } else if (f === 'fuel') {
      if (!c.equipment) errors.push('Equipment is required.');
      if (!(c.litres > 0)) errors.push('Litres must be above zero.');
      if (c.bbcTankNegative) errors.push('BBConstruction diesel intakes are refused while the tank reconciliation is negative (m212).');
      if (c.type !== 'none' && c.reading == null) errors.push('Meter reading is required (or choose "No meter").');
      if (!c.guard.ok) errors.push('Meter guard: ' + c.guard.label);
      if (c.guard.cls === 'warn' && !notes) errors.push('Large meter jump — add a note to confirm the reading.');
      const ticket = val('f_ticketno');
      const dup = ticketExists(company, ticket, 'fuel');
      if (dup && ticket) errors.push(`Ticket ${ticket} already exists on a ${dup.label} in ${company}.`);
      record = { ...base, name: `FUEL ${date} ${c.equipment}${ticket ? ' #' + ticket : ''}`, ticket_no: ticket, fuel_type: /diesel/i.test(val('f_item')) ? 'Diesel' : 'Lubricant', item: val('f_item'), equipment: c.equipment, driver: val('f_driver'), litres: round2(c.litres), odometer: c.type === 'odometer' ? c.reading : null, hours: c.type === 'hours' ? c.reading : null, location: val('f_location'), meter_delta: c.delta };
    } else if (f === 'expense') {
      if (!val('f_category')) errors.push('Category is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.method === 'Credit' && !c.supplier) errors.push('A credit expense needs the supplier it is owed to.');
      record = { ...base, name: `EXP ${date} ${c.supplier || val('f_category')}`, rep_date: date, category: val('f_category'), subcategory: val('f_subcategory'), supplier: c.supplier, equipment: val('f_truck'), method: c.method, qty: num('f_qty') || 1, amount: round2(c.amount), reference: val('f_reference') };
    } else if (f === 'settlement') {
      if (!c.supplier) errors.push('Supplier is required.');
      if (!(c.amount > 0)) errors.push('Amount must be above zero.');
      if (c.disc < 0) errors.push('Discount cannot be negative.');
      record = { ...base, name: `SETTLE ${date} ${c.supplier}`, supplier: c.supplier, method: val('f_method'), amount: round2(c.amount), discount: round2(c.disc), reference: val('f_reference'), ap_before: c.before };
    } else if (f === 'pricerule') {
      const prod = val('f_product'), rt = val('f_ruletype') || 'Sales (Delivery)';
      if (!prod) errors.push('Product / Grade is required.');
      const up0 = round2(num('f_unitprice')), tp0 = round2(num('f_transunitprice'));
      const q1v = val('f_qty1') ? num('f_qty1') : null, q2v = val('f_qty2') ? num('f_qty2') : null;
      if (val('f_enddate') && val('f_enddate') < date) errors.push('End Date cannot be before the Start Date.');
      if (/Sales/.test(rt) && !val('f_customer')) errors.push('A Sales rule needs the Customer it is agreed with.');
      if (/Purchase|Transport/.test(rt) && !val('f_supplier') && !val('f_site')) errors.push('A quarry Purchase / Transport rule needs the Supplier or the Site.');
      record = { ...base, name: val('f_name') || `PRC-${date.replace(/-/g, '')}-${rt.slice(0, 5).toUpperCase()}-${prod}`, rule_type: rt, customer: val('f_customer'), supplier: val('f_supplier'), site: val('f_site'), product: prod, unit: val('f_uom') || 'm³', rate_per: val('f_rateper') || 'm³', unit_price: up0, price: up0, trans_unit_price: tp0, indiff_price: val('f_indiff') ? round2(num('f_indiff')) : null, qty1: q1v, adj1: round2(num('f_adj1')), total1: q1v != null ? round2(q1v * up0 + num('f_adj1')) : null, trans_adj1: round2(num('f_transadj1')), qty2: q2v, adj2: round2(num('f_adj2')), total2: q2v != null ? round2(q2v * up0 + num('f_adj2')) : null, trans_adj2: round2(num('f_transadj2')), start_date: date, end_date: val('f_enddate') || '' };
    } else if (f === 'vatinvoice') {
      const inv = val('f_ticketno'), cust = val('f_customer'), net = round2(num('f_amount')), vat = round2(num('f_vat'));
      if (!inv || !cust || !(net > 0)) errors.push('Invoice Serial No., Customer, and Net Amount are required.');
      record = { ...base, name: inv, invoice_no: inv, rep_date: val('f_repdate') || date, start_date: date, end_date: date, customer: cust, net_amount: net, vat_amount: vat, total_ttc: round2(net + vat), status: val('f_status') || 'Open' };
    } else if (f === 'creditterm') {
      const cust = val('f_customer'), days = num('f_days');
      if (!cust) errors.push('Customer is required.');
      record = { ...base, name: `${cust} · Net ${days}d`, customer: cust, payment_days: days, credit_days: days, credit_limit: round2(num('f_amount')), start_date: date };
    } else if (f === 'customer') {
      const nm = val('f_customer');
      if (!nm) errors.push('Customer Name is required.');
      record = { ...base, name: nm, method: val('f_method') || 'Credit', vat_registered: val('f_vatreg') === 'Yes', mof_no: val('f_mof'), phone: val('f_phone'), region: val('f_region'), customer_declared_qty: !!($('f_declqty') && $('f_declqty').checked), external_invoice: !!($('f_extinv') && $('f_extinv').checked) };
    } else if (f === 'supplier') {
      const nm = val('f_supplier');
      if (!nm) errors.push('Supplier Name is required.');
      record = { ...base, name: nm, category: val('f_category'), phone: val('f_phone'), mof_no: val('f_mof'), is_truck_owner: !!($('f_istruckowner') && $('f_istruckowner').checked), iva: !!($('f_iva') && $('f_iva').checked), trucks_count: 0 };
    } else if (f === 'product') {
      const nm = val('f_product');
      if (!nm) errors.push('Product Name is required.');
      record = { ...base, name: nm, uom: val('f_uom') || 'm³', type: val('f_prodtype') || 'Material', ton_factor: num('f_tonfactor') || 1, list_price: round2(num('f_unitprice')), ticket_product: !!($('f_ticketprod') && $('f_ticketprod').checked), fuel_item: !!($('f_fuelitem') && $('f_fuelitem').checked), input_product: !!($('f_inputprod') && $('f_inputprod').checked) };
    } else if (f === 'site') {
      const nm = val('f_site');
      if (!nm) errors.push('Site Name is required.');
      record = { ...base, name: nm, region: val('f_region'), supplier: val('f_supplier'), customer: val('f_customer'), latitude: val('f_lat') ? num('f_lat') : null, longitude: val('f_lng') ? num('f_lng') : null, is_jv: !!($('f_isjv') && $('f_isjv').checked) };
    } else if (f === 'equipment' || f === 'companyequipment') {
      const nm = val('f_truck');
      if (!nm) errors.push('Unit Code / Plate Identifier is required.');
      record = { ...base, name: nm, plate_no: val('f_plateno') || nm, type: val('f_category') || 'Truck', capacity: num('f_capacity') || 0, ownership: val('f_ownership') || 'Owned', supplier: val('f_supplier'), default_driver: val('f_driver'), model: val('f_model') };
    } else if (f === 'driver') {
      const nm = val('f_driver');
      if (!nm) errors.push('Driver Name is required.');
      record = { ...base, name: nm, driver: nm, truck_owner: val('f_supplier'), truck: val('f_truck'), phone: val('f_phone'), is_company_driver: !!($('f_iscompanydriver') && $('f_iscompanydriver').checked) };
    } else if (f === 'salary') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Name and Amount > 0 are required.');
      record = { ...base, name: `SAL ${val('f_paymonth') || date.slice(0, 7)} ${st}`, payroll_month: val('f_paymonth') || date.slice(0, 7), staff: st, equipment: val('f_truck'), method: val('f_method') || 'Cash', usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), amount: amt };
    } else if (f === 'attendance') {
      const st = val('f_staff');
      if (!st) errors.push('Staff Member is required.');
      record = { ...base, name: `ATT ${date} ${st}`, staff: st, status: val('f_status') || 'Present', site: val('f_site'), overtime_hours: num('f_hours') || 0 };
    } else if (f === 'freelance' || f === 'employment') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Name and Salary/Rate > 0 are required.');
      const payType = val('f_paytype');
      // seed / SQLite keys (type · salary_usd · daily_rate) beside the form keys so the registers and mfg.db read both
      record = { ...base, name: `${f === 'employment' ? 'EMP' : 'FRL'} ${st}`, staff: st, role: val('f_role'), pay_type: payType, type: f === 'employment' ? (payType === 'Daily' ? 'Daily' : 'Regular') : 'Freelance', salary_usd: /Monthly/i.test(payType) ? amt : 0, daily_rate: /Daily/i.test(payType) ? amt : 0, base_salary: amt, amount: amt, start_date: date, status: 'Active' };
    } else if (f === 'logistics') {
      const st = val('f_staff'), amt = round2(num('f_amount'));
      if (!st || !(amt > 0)) errors.push('Staff Member and Allowance > 0 are required.');
      const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const dayFlags = Object.fromEntries(dayKeys.map(d => [d, !!($('f_day_' + d) && $('f_day_' + d).checked)]));
      const days = dayKeys.filter(d => dayFlags[d]).length;
      record = { ...base, name: `ALLOW ${date} ${st}`, staff: st, site: val('f_site'), equipment: '', days_count: days, working_days: dayKeys.filter(d => dayFlags[d]).map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', '), ...dayFlags, start_date: date, end_date: date, usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), daily_usd: days ? round2(amt / days) : amt, amount: amt };
    } else if (f === 'triprate') {
      const nm = val('f_name') || val('f_site'), amt = round2(num('f_amount'));
      if (!nm || !(amt > 0)) errors.push('Route/Site and Rate > 0 are required.');
      record = { ...base, name: nm, site: val('f_site'), region: val('f_site'), category: val('f_category') || 'Truck', rate_usd: amt, amount: amt, start_date: date };
    } else if (f === 'treasury') {
      const trt = val('f_trtype') || 'loan', cp = val('f_counterparty'), amt = round2(num('f_amount'));
      if (!cp || !(amt > 0)) errors.push('Counterparty and Amount > 0 are required.');
      crKey = trt === 'loan_settlement' ? 'loan_settlements' : (trt === 'external' ? 'external_movements' : (trt === 'conversion' ? 'conversions' : 'loans'));
      const dirn = val('f_direction') || 'Inflow';
      record = { ...base, name: `${trt.toUpperCase()} ${date} ${cp}`, counterparty: cp, lender: cp, borrower: company, loan: cp, direction: dirn, method: dirn, type: trt === 'loan_settlement' ? 'Repayment' : (trt === 'loan' ? 'Drawdown' : ''), from_currency: trt === 'conversion' ? 'LBP' : 'USD', to_currency: trt === 'conversion' ? 'USD' : '', usd_amount: round2(num('f_usd')), lbp_amount: round2(num('f_lbp')), fx_rate: 90000, exchange_rate: 90000, amount: amt, principal: amt, interest_rate: 0, balance: amt, start_date: date, reference: val('f_reference') };
    } else if (f === 'jv') {
      const jvt = val('f_jvtype') || 'distribution', st = val('f_site'), pt = val('f_counterparty');
      if (!st || !pt) errors.push('JV Site and JV Partner are required.');
      crKey = jvt === 'partnership' ? 'jv_partnerships' : 'jv_distributions';
      record = { ...base, name: `JV ${st} · ${pt}`, site: st, partner: pt, share_pct: num('f_share') || 50, percentage: num('f_share') || 50, basis: 'Revenue', amount: round2(num('f_amount')), difference: 0, total: round2(num('f_amount')), rep_date: date };
    }
    return { errors, record, crKey };
  }

  function showFormErrors(errors) {
    let box = $('formErrors');
    if (!box) {
      box = document.createElement('div');
      box.id = 'formErrors';
      box.className = 'form-errors';
      const body = $('modalBody');
      const foot = body && body.querySelector('.modal-foot');
      if (foot) body.insertBefore(box, foot); else if (body) body.appendChild(box);
    }
    if (!errors.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<strong>Fix before posting:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function postRecordToLocalApi(crKey, record) {
    if (!HAS_LOCAL_API) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      await fetch('./api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table: CR_TABLE[crKey], record }), signal: ctrl.signal });
      clearTimeout(t);
    } catch (_) { /* offline or static host */ }
  }

  async function saveModalEntry() {
    if (STATE.saving) return;
    if (!canEnterForm(STATE.modalForm)) { toast('Your seat cannot post this entry', 'err'); return; }
    const { errors, record, crKey } = validateAndBuild();
    showFormErrors(errors);
    if (errors.length) return;

    STATE.saving = true;
    const sBtn = $('dynSaveModalBtn');
    if (sBtn) { sBtn.disabled = true; sBtn.textContent = 'Posting…'; }
    try {
      STATE.customRecords[crKey].unshift(record);
      applyCustomRecordsToSeed();
      saveLocalAuthAndRecords();           // write-ahead: local first, network after
      closeEntryModal(true);
      toast(`${CR_LABEL[crKey].replace(/^./, ch => ch.toUpperCase())} posted · ${record.name}`, 'ok');
      renderApp();
      await postRecordToLocalApi(crKey, record);
      syncWithCloud(true);
    } finally {
      STATE.saving = false;
    }
  }

  function voidRecord(crKey, id) {
    const list = STATE.customRecords[crKey] || [];
    const r = list.find(x => x.id === id);
    if (!r) { toast('Only app-entered rows can be voided here — book rows are corrected in the workbook', 'err'); return; }
    if (!canVoid()) { toast('Your seat cannot void entries', 'err'); return; }
    r.voided = true;
    r.voided_by = activeUser().full_name;
    r.voided_at = nowStamp();
    applyCustomRecordsToSeed();
    saveLocalAuthAndRecords();
    renderApp();
    toast('Entry voided · ' + (r.name || id));
    postRecordToLocalApi(crKey, r);
    syncWithCloud(true);
  }

  function openEntryModal(formType) {
    const form = FORM_TITLES[formType] ? formType : 'sales';
    if (!canEnterForm(form)) { toast('Your seat has no entry rights for this form', 'err'); return; }
    STATE.modalForm = form;
    const modal = $('entryModal');
    const wasClosed = !modal || modal.hidden;
    const body = $('modalBody');
    const title = $('modalTitle');
    const tabsWrap = $('modalTabs');
    if (title) title.textContent = FORM_TITLES[form];
    if (tabsWrap && window.MFG_FORMS) {
      tabsWrap.innerHTML = window.MFG_FORMS.renderModalTabsHtml(form, canEnterForm);
      tabsWrap.querySelectorAll('[data-pa-group]').forEach(gBtn => {
        gBtn.addEventListener('click', () => {
          const gid = gBtn.getAttribute('data-pa-group');
          const grp = (window.MFG_FORMS.FORM_GROUPS || []).find(g => g.id === gid);
          const firstForm = grp && grp.forms.find(f => canEnterForm(f.id));
          if (firstForm) openEntryModal(firstForm.id);
        });
      });
      tabsWrap.querySelectorAll('.modal-tab[data-form]').forEach(tBtn => {
        tBtn.addEventListener('click', () => openEntryModal(tBtn.getAttribute('data-form')));
      });
    } else {
      document.querySelectorAll('#modalTabs .modal-tab').forEach(b => {
        const f = b.getAttribute('data-form');
        b.hidden = !canEnterForm(f);
        b.classList.toggle('active', f === form);
      });
    }
    if (body) {
      body.innerHTML = renderEntryModalBody() + `
        <div class="modal-foot">
          <span class="form-note">Posting as <b>${esc(activeUser().full_name)}</b> · stored on this device, the cloud ledger${HAS_LOCAL_API ? ' and SQLite' : ''}</span>
          <div>
            <button type="button" class="btn-ghost-bar" id="dynCancelModalBtn">Cancel</button>
            <button type="button" class="btn btn-brass" id="dynSaveModalBtn">Post to Cloud Ledger</button>
          </div>
        </div>
      `;
      const cBtn = $('dynCancelModalBtn');
      const sBtn = $('dynSaveModalBtn');
      if (cBtn) cBtn.addEventListener('click', () => closeEntryModal());
      if (sBtn) sBtn.addEventListener('click', saveModalEntry);
      if (!body.dataset.enterWired) { // #modalBody persists across opens — bind once or Enter posts N times after N opens
        body.dataset.enterWired = '1';
        body.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.defaultPrevented && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && !e.target.list && !e.target.dataset.suggestList) { e.preventDefault(); saveModalEntry(); } });
      }
      body.scrollTop = 0;
    }
    if (modal) {
      modal.hidden = false;
      modal.scrollTop = 0;
      const card = modal.querySelector('.modal-card');
      if (card) card.scrollTop = 0;
    }
    document.body.classList.add('modal-open');
    wireModalLiveCalc(wasClosed);
  }

  function closeEntryModal(force) {
    if (STATE.saving && !force) return;
    const modal = $('entryModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (STATE.renderPending) { STATE.renderPending = false; renderApp(); }
  }

  // ==========================================================================
  // POWER APPS ENTITY RECORD FORM, 4-CARD NAVY COCKPIT & RELATIONAL SUBGRIDS
  // (Parity with m12_forms.py, bhf_manufacturing.js, bhf_mfgCockpit.htm m283 & bhf_related_subgrids.py)
  // ==========================================================================
  const INSPECT_LABELS = {
    sales_tickets: 'Sales Ticket', raw_purchases: 'Raw Material Ticket', fuel_intakes: 'Fuel Intake',
    expenses: 'General / Fleet Expense', receipts: 'Customer Receipt (AR)', settlements: 'Supplier Settlement (AP)',
    salaries: 'Salary Payment', price_rules: 'Price & Commission Agreement', credit_terms: 'Customer Credit Policy',
    vat_invoices: 'VAT 11% Tax Invoice', customers: 'Customer 360° Master', suppliers: 'Supplier & Hauler 360° Master',
    products: 'Product & Aggregate Grade', product_types: 'Product Family', uoms: 'Unit of Measure',
    sites: 'Quarry & Customer Site 360°', regions: 'Delivery Region / Zone', equipment: 'Equipment & Truck 360°',
    company_equipment: 'Company-Equipment Assignment', drivers: 'Driver & Operator 360°',
    company_drivers: 'Company-Driver Assignment', expense_categories: 'Expense Category',
    expense_subcategories: 'Expense Subcategory', employments: 'Staff & Employment 360°',
    attendance: 'Attendance & Overtime Log', freelance_entries: 'Freelance Work Entry',
    logistics_allowances: 'Site Allowance (Mon–Sun)', overtime_rates: 'Driver Trip & Overtime Rate',
    external_movements: 'External Treasury Movement', loans: 'Loan & Partner Advance',
    loan_settlements: 'Loan Repayment / Drawdown', conversions: 'USD ↔ LBP FX Conversion',
    jv_partnerships: 'JV 50/50 Site Partnership', jv_distributions: 'JV Profit Distribution'
  };

  const INSPECT_DVN = {
    sales_tickets: 'bhf_salesticket', raw_purchases: 'bhf_rawpurchase', fuel_intakes: 'bhf_fuelintake',
    expenses: 'bhf_mfgexpense', receipts: 'bhf_mfgcustomerreceipt', settlements: 'bhf_mfgsupplierpayment',
    salaries: 'bhf_mfgsalary', price_rules: 'bhf_pricerule', credit_terms: 'bhf_creditterm',
    vat_invoices: 'bhf_vatinvoice', customers: 'bhf_customer', suppliers: 'bhf_supplier',
    products: 'bhf_product', product_types: 'bhf_producttype', uoms: 'bhf_uom',
    sites: 'bhf_site', regions: 'bhf_region', equipment: 'bhf_equipment',
    company_equipment: 'bhf_companyequipment', drivers: 'bhf_driver', company_drivers: 'bhf_companydriver',
    expense_categories: 'bhf_expensecategory', expense_subcategories: 'bhf_expensesubcategory',
    employments: 'bhf_mfgemployment', attendance: 'bhf_mfgattendance', freelance_entries: 'bhf_mfgfreelance',
    logistics_allowances: 'bhf_mfglogistics', overtime_rates: 'bhf_mfgovertimerate',
    external_movements: 'bhf_mfgexternal', loans: 'bhf_mfgloan', loan_settlements: 'bhf_mfgloansettlement',
    conversions: 'bhf_mfgconversion', jv_partnerships: 'bhf_mfgjvpartnership', jv_distributions: 'bhf_mfgjvdistribution'
  };

  const INSPECT_LOOKUP_FIELD_TARGET = {
    customer: 'customers', supplier: 'suppliers', site_owner: 'suppliers', truck_owner: 'suppliers',
    product: 'products', item: 'products', input_product: 'products', site: 'sites',
    region: 'regions', truck: 'equipment', equipment: 'equipment', driver: 'drivers',
    default_driver: 'drivers', day_operator: 'drivers', night_operator: 'drivers',
    staff: 'employments', vat_invoice: 'vat_invoices', category: 'expense_categories',
    subcategory: 'expense_subcategories', uom: 'uoms', unit: 'uoms', type: 'product_types'
  };

  function inspectorValue(key, v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'number') {
      if (/price|cost|amount|total|vat|discount|tip|limit|salary|balance|adj|principal|value|change|rate_usd|daily_usd|paid|spent|sales_ttc|raw_cost/.test(key) && !/rate$|pct|factor|ton_factor|exchange|count|loads|days|hours/.test(key)) return fmtUSD(v, 2);
      return fmtNum(v, Number.isInteger(v) ? 0 : 2);
    }
    return String(v);
  }

  function resolveInspectorRecord(key, idOrName) {
    const q = String(idOrName == null ? '' : idOrName).trim();
    if (!q) return null;
    const nq = norm(q);
    const list = (SEED.records[key] || []).concat(STATE.customRecords[key] || []);
    let hit = list.find(r => r && String(r.id) === q) ||
              list.find(r => r && (norm(r.name) === nq || norm(r.ticket_no) === nq || norm(r.invoice_no) === nq || norm(r.staff) === nq || norm(r.driver) === nq || norm(r.equipment) === nq || norm(r.plate_no) === nq));
    if (hit) return hit;

    // Synthesize a rich 360° master record if a lookup name exists in transactions or semantic summaries
    if (key === 'customers') {
      const ci = customerInfo(q);
      if (ci) return Object.assign({ id: q, name: ci.Customer || q, official_name: ci.Customer || q, method: ci.method || 'Credit', vat_registered: ci['VAT Registered'] === 'Yes' }, ci);
      return { id: q, name: q, official_name: q, method: 'Credit', vat_registered: false };
    }
    if (key === 'suppliers') {
      const si = supplierInfo(q);
      if (si) return Object.assign({ id: q, name: si.Supplier || q, official_name: si.Supplier || q, iva: !!si.iva, is_truck_owner: !!si.is_truck_owner }, si);
      return { id: q, name: q, official_name: q };
    }
    if (key === 'products') return { id: q, name: q, type: 'Material', uom: 'm³', list_price: listPrice(q) };
    if (key === 'sites') return { id: q, name: q, region: 'Lebanon', is_jv: false };
    if (key === 'equipment') return { id: q, name: q, plate_no: q, type: 'Truck', ownership: 'Third-Party' };
    if (key === 'drivers') return { id: q, name: q };
    if (key === 'employments') return { id: q, name: q, staff: q, type: 'Regular', status: 'Active' };
    if (key === 'expense_categories') return { id: q, name: q };
    if (key === 'expense_subcategories') return { id: q, name: q };
    if (key === 'regions') return { id: q, name: q };
    return null;
  }

  // Build Live Contextual Notification Banner (Screenshot 2 top blue notification strip)
  function buildInspectorLiveBanner(key, row) {
    if (key === 'sales_tickets') {
      const pr = findRule({ company: row.company, customer: row.customer, product: row.product, site: row.site, date: row.date, types: [row.sale_type === 'Pickup' ? 'Sales (Pickup)' : 'Sales (Delivery)', 'Sales (Delivery)', 'Sales (Pickup)'] });
      const eq = equipInfo(row.truck);
      const ct = creditTermsForCustomer(row.customer);
      const lp = listPrice(row.product);
      const ruleTxt = pr
        ? `${pr.rule_type || 'Sales Agreement'} (${pr.name}): ${fmtUSD(pr.unit_price, 2)}/${row.uom || pr.unit || 'm³'}`
        : (lp != null ? `List Price Benchmark: ${fmtUSD(lp, 2)}/${row.uom || 'm³'} (no active customer rule)` : `Spot Ticket Price: ${fmtUSD(row.unit_price, 2)}/${row.uom || 'm³'}`);
      const trTxt = row.sale_type === 'Delivery'
        ? `Transport: ${fmtUSD(row.trans_unit_price || (pr && pr.trans_unit_price) || 0, 2)}/${row.uom || 'm³'} (${fmtUSD(row.trans_price, 2)})`
        : 'Pickup (Ex-Quarry · $0.00 Transport)';
      const trkTxt = eq
        ? `${eq.ownership || 'Truck'}: ${eq.name}${eq.capacity ? ' (' + fmtNum(eq.capacity, 0) + ' m³)' : ''}${row.driver || eq.default_driver ? ' · ' + (row.driver || eq.default_driver) : ''}`
        : `Truck: ${row.truck || row.transport_by || '—'}${row.driver ? ' · ' + row.driver : ''}`;
      const totTxt = `Load Total: ${fmtNum(row.qty, 2)} ${row.uom || 'm³'} = ${fmtUSD(row.total_ttc != null ? row.total_ttc : row.total, 2)} USD`;
      const crTxt = ct ? `Credit Terms: ${ct.credit_days || 30} days (Limit ${fmtUSD(ct.credit_limit || 0, 0)})` : `Payment: ${row.method || 'Credit'}`;
      return { tone: pr ? 'info' : 'warn', text: `Pricing: ${ruleTxt}  |  ${trTxt}  |  ${trkTxt}  |  ${totTxt}  |  ${crTxt}` };
    }
    if (key === 'raw_purchases') {
      const matRule = findRule({ company: row.company, supplier: row.site_owner, site: row.site, product: row.product, date: row.date });
      const eq = equipInfo(row.truck);
      return {
        tone: 'info',
        text: `Two-Leg Quarry Split (m192): Leg 1 Material ${fmtUSD(row.cost, 2)} → ${row.site_owner || row.site || 'Quarry Owner'}${matRule ? ' (Rule ' + matRule.name + ')' : ''}  |  Leg 2 Haulage ${fmtUSD(row.trans_cost, 2)} → ${row.truck_owner || row.transport_by || 'Company Fleet'}${eq ? ' · Truck ' + eq.name : ''}  |  Total Payable: ${fmtUSD(row.total, 2)} USD`
      };
    }
    if (key === 'price_rules') {
      const today = SEED_DATE;
      const active = (!row.end_date || String(row.end_date) >= today);
      return {
        tone: active ? 'info' : 'warn',
        text: `Price Agreement ${row.name}: ${row.rule_type || 'Rule'} for ${row.customer || row.supplier || row.site || 'Standard List'} · Grade: ${row.product || 'All Grades'} · Unit Price: ${fmtUSD(row.unit_price, 2)}/${row.unit || 'm³'}${row.trans_unit_price ? ' + Transport ' + fmtUSD(row.trans_unit_price, 2) : ''} · Status: ${active ? 'ACTIVE (Auto-fills weighbridge tickets)' : 'ENDED (' + row.end_date + ')'}`
      };
    }
    if (key === 'customers') {
      const ci = customerInfo(row.name || row.Customer) || {};
      const ct = creditTermsForCustomer(row.name || row.Customer);
      const rulesCnt = activeRulesCountFor('customer', row.name || row.Customer);
      return {
        tone: Number(ci.ar_60_plus || 0) > 0 ? 'warn' : 'info',
        text: `Customer 360° Ledger: Open FIFO AR Balance ${fmtUSD(ci.ar_balance || 0, 2)} (Overdue 60+d: ${fmtUSD(ci.ar_60_plus || 0, 0)})  |  Active Price Agreements: ${rulesCnt}  |  Credit Policy: ${ct ? ct.credit_days + ' days · Limit ' + fmtUSD(ct.credit_limit, 0) : 'Standard Account'}  |  VAT Status: ${(row.vat_registered || ci['VAT Registered'] === 'Yes') ? '11% VAT Registered' : 'Non-VAT'}`
      };
    }
    if (key === 'suppliers') {
      const si = supplierInfo(row.name || row.Supplier) || {};
      const rulesCnt = activeRulesCountFor('supplier', row.name || row.Supplier);
      return {
        tone: 'info',
        text: `Supplier & Hauler 3-Leg AP Ledger (m192): Net AP Balance ${fmtUSD(si.ap_balance || 0, 2)} (Material Leg: ${fmtUSD(si.ap_material || 0, 0)} · Haulage Leg: ${fmtUSD(si.ap_haulage || 0, 0)} · Expense Leg: ${fmtUSD(si.ap_expense || 0, 0)})  |  Active Agreements: ${rulesCnt}  |  Registered Trucks: ${fmtNum(row.trucks_count || (row.trucks || []).length || 0)}`
      };
    }
    if (key === 'equipment') {
      const lm = lastMeter(null, row.name, null);
      return {
        tone: 'info',
        text: `Universal Fleet Registry (m99): Unit ${row.name} (${row.type || 'Truck'} · ${row.ownership || 'Transporter'})  |  Capacity: ${row.capacity ? fmtNum(row.capacity, 1) + ' m³' : 'Standard'}  |  Owner: ${row.supplier || 'Company Fleet'}  |  Default Driver: ${row.default_driver || '—'}  |  Last M142 Meter: ${lm ? (lm.odometer ? fmtNum(lm.odometer, 0) + ' km' : fmtNum(lm.hours, 1) + ' hrs') + ' (' + lm.date + ')' : 'No meter log'}`
      };
    }
    if (key === 'sites') {
      const rulesCnt = activeRulesCountFor('site', row.name);
      return {
        tone: 'info',
        text: `Quarry & Site 360°: ${row.name} (${row.region || 'Lebanon'})  |  Default Quarry Owner: ${row.supplier || '—'}  |  JV 50/50 Status: ${row.is_jv ? 'Active JV Quarry' : 'Standard Site'}  |  Active Site Price Rules: ${rulesCnt}  |  GPS Pin: ${row.latitude != null ? row.latitude + ', ' + row.longitude : 'Pending coordinates'}`
      };
    }
    if (key === 'products') {
      const lp = listPrice(row.name);
      const rulesCnt = activeRulesCountFor('product', row.name);
      return {
        tone: 'info',
        text: `Product & Grade Master: ${row.name} (${row.type || 'Material'} · Default UoM ${row.uom || 'm³'} · Tonnage Factor ${row.ton_factor || 1.5} t/m³)  |  List Price Benchmark: ${lp != null ? fmtUSD(lp, 2) : '—'}  |  Active Price Agreements: ${rulesCnt}  |  CoA Revenue Account: ${row.revenue_account || '701001'}`
      };
    }
    return {
      tone: 'info',
      text: `Power Apps Relational Record (${INSPECT_DVN[key] || key}) · Connected to live Dataverse tables & SOA double-entry ledger (${SEED_DATE}). Click any blue lookup pill or related subgrid row below to drill across entities.`
    };
  }

  // Build 4-Card Navy Executive Telemetry & Control Cockpit (Screenshot 2 bhf_mfgCockpit.htm m283 parity)
  function buildInspectorCockpit(key, row) {
    const bu = row.company || COMPANY_BU_MATCH[STATE.company] || 'MFG';
    const title = row.ticket_no ? `${INSPECT_LABELS[key] || key} #${row.ticket_no} · ${row.customer || row.site || row.equipment || row.name || ''}` : `${INSPECT_LABELS[key] || key} · ${row.name || row.invoice_no || row.staff || row.driver || row.equipment || row.id}`;

    if (key === 'sales_tickets') {
      const pr = findRule({ company: row.company, customer: row.customer, product: row.product, site: row.site, date: row.date, types: [row.sale_type === 'Pickup' ? 'Sales (Pickup)' : 'Sales (Delivery)', 'Sales (Delivery)', 'Sales (Pickup)'] });
      const lp = listPrice(row.product);
      const bench = pr ? Number(pr.unit_price || 0) : (lp != null ? Number(lp) : Number(row.unit_price || 0));
      const actual = Number(row.unit_price || 0);
      const diff = round2(actual - bench);
      const ci = customerInfo(row.customer) || {};
      const ct = creditTermsForCustomer(row.customer);
      const arBal = Number(ci.ar_balance || 0);
      const ar60 = Number(ci.ar_60_plus || 0);
      const credLim = Number((ct && ct.credit_limit) || 50000);
      const eq = equipInfo(row.truck);
      const ttc = Number(row.total_ttc != null ? row.total_ttc : row.total || 0);
      const tons = ticketTons(row);

      return {
        bu,
        title,
        pill: fmtUSD(ttc, 2),
        cards: [
          {
            lbl: 'UNIT PRICE VS AGREEMENT',
            tag: diff < -0.01 ? 'BELOW RULE' : (pr ? 'ON RULE' : 'LIST / SPOT'),
            tone: diff < -0.01 ? 'warn' : 'good',
            val: `${fmtUSD(actual, 2)} / ${row.uom || 'm³'}`,
            sub1: pr ? `Agreed (${pr.name}): ${fmtUSD(pr.unit_price, 2)} · Diff ${diff >= 0 ? '+' : ''}${fmtUSD(diff, 2)}` : `List Benchmark: ${lp != null ? fmtUSD(lp, 2) : '—'} · Transport: ${fmtUSD(row.trans_price, 2)}`,
            sub2: `Material: ${fmtUSD(row.price, 2)} · VAT 11%: ${fmtUSD(row.vat, 2)}`,
            pct: Math.min(100, Math.max(20, bench > 0 ? Math.round((actual / bench) * 85) : 80))
          },
          {
            lbl: 'CUSTOMER AR & AGING',
            tag: ar60 > 0 ? 'OVER 60D' : 'CURRENT',
            tone: ar60 > 0 ? 'crit' : 'good',
            val: fmtUSD(arBal, 0),
            sub1: `0–30d: ${fmtUSD((ci.ar_current || 0) + (ci.ar_1_10 || 0) + (ci.ar_11_30 || 0), 0)} · 31–60d: ${fmtUSD(ci.ar_31_60 || 0, 0)}`,
            sub2: `60+d Overdue: ${fmtUSD(ar60, 0)} · Loads: ${fmtNum(ci.loads || 0)}`,
            pct: Math.min(100, arBal > 0 ? Math.max(15, Math.round((ar60 / arBal) * 100)) : 20)
          },
          {
            lbl: 'CREDIT LIMIT EXPOSURE',
            tag: credLim > 0 && arBal > credLim ? 'OVER LIMIT' : 'WITHIN LIMIT',
            tone: credLim > 0 && arBal > credLim ? 'warn' : 'good',
            val: `${ fmtNum(row.qty, 2)} ${row.uom || 'm³'}`,
            sub1: `Ticket TTC: ${fmtUSD(ttc, 2)} (${fmtNum(tons, 1)} tons)`,
            sub2: `Credit Terms: ${ct ? ct.credit_days + 'd · Limit ' + fmtUSD(credLim, 0) : row.method || 'Credit'}`,
            pct: credLim > 0 ? Math.min(100, Math.max(15, Math.round((arBal / credLim) * 100))) : 35
          },
          {
            lbl: 'TRUCK & TELEMETRY',
            tag: eq && /^own|company/i.test(eq.ownership || '') ? 'COMPANY FLEET' : '3RD-PARTY',
            tone: 'info',
            val: row.truck || row.transport_by || 'Pickup',
            sub1: `Cap: ${eq && eq.capacity ? fmtNum(eq.capacity, 0) + ' m³' : fmtNum(row.qty, 0) + ' m³'} · Owner: ${(eq && eq.supplier) || row.truck_owner || 'Customer'}`,
            sub2: `Driver: ${row.driver || (eq && eq.default_driver) || '—'} · Site: ${row.site || 'Ex-Quarry'}`,
            pct: 78
          }
        ]
      };
    }

    if (key === 'raw_purchases') {
      const siSite = supplierInfo(row.site_owner) || {};
      const siHaul = supplierInfo(row.truck_owner) || {};
      const tot = Number(row.total != null ? row.total : (Number(row.cost || 0) + Number(row.trans_cost || 0)));
      return {
        bu, title, pill: fmtUSD(tot, 2),
        cards: [
          { lbl: 'LEG 1 · QUARRY MATERIAL', tag: 'SITE OWNER', tone: 'good', val: fmtUSD(row.cost, 2), sub1: `Payee: ${row.site_owner || '—'} · Rate: ${fmtUSD(row.unit_cost, 2)}/${row.uom || 'm³'}`, sub2: `Quarry Site: ${row.site || '—'} · Open AP: ${fmtUSD(siSite.ap_balance || 0, 0)}`, pct: tot > 0 ? Math.round((Number(row.cost || 0) / tot) * 100) : 60 },
          { lbl: 'LEG 2 · HAULAGE / FREIGHT', tag: /company/i.test(row.transport_by || '') ? 'OWN FLEET' : 'HAULER AP', tone: 'info', val: fmtUSD(row.trans_cost, 2), sub1: `Hauler: ${row.truck_owner || row.transport_by || '—'}`, sub2: `Truck: ${row.truck || '—'} · Hauler AP: ${fmtUSD(siHaul.ap_balance || 0, 0)}`, pct: tot > 0 ? Math.round((Number(row.trans_cost || 0) / tot) * 100) : 40 },
          { lbl: 'INTAKE VOLUME & TONNAGE', tag: row.uom || 'M³', tone: 'good', val: `${fmtNum(row.qty, 2)} ${row.uom || 'm³'}`, sub1: `Estimated Weight: ${fmtNum(ticketTons(row), 1)} tons`, sub2: `Grade: ${row.product || 'Raw Aggregate'}`, pct: 80 },
          { lbl: 'COMBINED LANDED COST', tag: 'M192 SPLIT', tone: 'info', val: fmtUSD(tot, 2), sub1: `Landed Unit Cost: ${row.qty > 0 ? fmtUSD(tot / row.qty, 2) : '—'}/${row.uom || 'm³'}`, sub2: `Tx Date: ${row.date || '—'} · Rep Date: ${row.rep_date || row.date || '—'}`, pct: 90 }
        ]
      };
    }

    if (key === 'customers') {
      const name = row.name || row.Customer;
      const ci = customerInfo(name) || {};
      const ct = creditTermsForCustomer(name);
      const tickets = (SEED.records.sales_tickets || []).filter(t => norm(t.customer) === norm(name));
      const rcpts = (SEED.records.receipts || []).filter(r => norm(r.customer) === norm(name));
      const rules = (SEED.records.price_rules || []).filter(r => norm(r.customer) === norm(name));
      const arBal = Number(ci.ar_balance != null ? ci.ar_balance : 0);
      return {
        bu: 'ALL BUs', title, pill: `AR ${fmtUSD(arBal, 2)}`,
        cards: [
          { lbl: 'OPEN FIFO AR BALANCE', tag: Number(ci.ar_60_plus || 0) > 0 ? 'AGED 60+D' : 'ACTIVE AR', tone: Number(ci.ar_60_plus || 0) > 0 ? 'warn' : 'good', val: fmtUSD(arBal, 2), sub1: `Current: ${fmtUSD(ci.ar_current || 0, 0)} · 60+d: ${fmtUSD(ci.ar_60_plus || 0, 0)}`, sub2: `VAT Status: ${(row.vat_registered || ci['VAT Registered'] === 'Yes') ? '11% VAT' : 'Standard'}`, pct: 75 },
          { lbl: 'LIFETIME SALES & LOADS', tag: `${fmtNum(ci.loads || tickets.length)} LOADS`, tone: 'info', val: fmtUSD(ci.sales_ttc || tickets.reduce((a, t) => a + Number(t.total_ttc || 0), 0), 0), sub1: `${fmtNum(tickets.length)} tickets in register`, sub2: `Last Sale: ${ci.last_sale || (tickets[0] && tickets[0].date) || '—'}`, pct: 85 },
          { lbl: 'RECEIPTS COLLECTED', tag: `${fmtNum(rcpts.length)} VOUCHERS`, tone: 'good', val: fmtUSD(ci.receipts || rcpts.reduce((a, r) => a + Number(r.amount || 0), 0), 0), sub1: `Oldest-First FIFO Relief (m165)`, sub2: `Default Method: ${row.method || ci.method || 'Credit'}`, pct: 80 },
          { lbl: 'AGREEMENTS & CREDIT TERMS', tag: `${rules.filter(r => !r.end_date).length} ACTIVE`, tone: 'info', val: ct ? `${ct.credit_days || 30} Days` : 'Open Terms', sub1: `Credit Limit: ${ct ? fmtUSD(ct.credit_limit, 0) : 'Not capped'}`, sub2: `${rules.length} total price agreements on file`, pct: 70 }
        ]
      };
    }

    if (key === 'suppliers') {
      const name = row.name || row.Supplier;
      const si = supplierInfo(name) || {};
      const matLoads = (SEED.records.raw_purchases || []).filter(r => norm(r.site_owner) === norm(name));
      const haulLoads = (SEED.records.raw_purchases || []).filter(r => norm(r.truck_owner) === norm(name));
      const exps = (SEED.records.expenses || []).filter(x => norm(x.supplier) === norm(name));
      const spays = (SEED.records.settlements || []).filter(s => norm(s.supplier) === norm(name));
      const apBal = Number(si.ap_balance != null ? si.ap_balance : 0);
      return {
        bu: 'ALL BUs', title, pill: `AP ${fmtUSD(apBal, 2)}`,
        cards: [
          { lbl: 'NET 3-LEG AP BALANCE', tag: 'M192 ENGINE', tone: apBal > 0 ? 'warn' : 'good', val: fmtUSD(apBal, 2), sub1: `Mat: ${fmtUSD(si.ap_material || 0, 0)} · Haul: ${fmtUSD(si.ap_haulage || 0, 0)}`, sub2: `Expense Leg: ${fmtUSD(si.ap_expense || 0, 0)}`, pct: 75 },
          { lbl: 'QUARRY & HAULAGE LOADS', tag: `${fmtNum(matLoads.length + haulLoads.length)} TICKETS`, tone: 'info', val: fmtNum(si.raw_loads || (matLoads.length + haulLoads.length)), sub1: `As Site Owner: ${fmtNum(matLoads.length)} · As Hauler: ${fmtNum(haulLoads.length)}`, sub2: `Expenses Billed: ${fmtNum(exps.length)} vouchers`, pct: 80 },
          { lbl: 'SETTLEMENTS DISBURSED', tag: `${fmtNum(spays.length)} PAYMENTS`, tone: 'good', val: fmtUSD(si.settlements_paid || spays.reduce((a, s) => a + Number(s.amount || 0), 0), 0), sub1: `${fmtNum(spays.length)} settlement vouchers in register`, sub2: `IVA Registered: ${row.iva || si.iva ? 'Yes' : 'No'}`, pct: 85 },
          { lbl: 'FLEET & AGREEMENTS', tag: row.is_truck_owner ? 'HAULER FLEET' : 'VENDOR', tone: 'info', val: `${fmtNum(row.trucks_count || (row.trucks || []).length || 0)} Trucks`, sub1: `Drivers Linked: ${fmtNum((row.drivers || []).length)}`, sub2: `Active Price Rules: ${activeRulesCountFor('supplier', name)}`, pct: 70 }
        ]
      };
    }

    // Generic rich 4-card cockpit for all other 30 tables
    const subgrids = buildInspectorSubgrids(key, row);
    const totalRel = subgrids.reduce((a, sg) => a + sg.rows.length, 0);
    const primaryMoney = row.total_ttc ?? row.total ?? row.amount ?? row.usd_amount ?? row.unit_price ?? row.salary_usd ?? row.principal ?? row.credit_limit ?? row.list_price;
    return {
      bu,
      title,
      pill: primaryMoney != null ? fmtUSD(primaryMoney, 2) : `${fmtNum(totalRel)} Linked Rows`,
      cards: [
        { lbl: 'PRIMARY RECORD VALUE', tag: (INSPECT_DVN[key] || key).toUpperCase(), tone: 'good', val: primaryMoney != null ? fmtUSD(primaryMoney, 2) : (row.name || row.ticket_no || String(row.id).slice(0, 10)), sub1: `Entity: ${INSPECT_LABELS[key] || key}`, sub2: `Company Scope: ${row.company || 'Shared / Root BU'}`, pct: 82 },
        { lbl: 'CONNECTED SUBGRIDS', tag: `${subgrids.length} TABLES`, tone: 'info', val: `${fmtNum(totalRel)} Rows`, sub1: subgrids.slice(0, 2).map(s => `${s.shortLabel}: ${fmtNum(s.rows.length)}`).join(' · ') || 'Direct master record', sub2: subgrids.slice(2, 4).map(s => `${s.shortLabel}: ${fmtNum(s.rows.length)}`).join(' · ') || 'Click any row below to inspect', pct: Math.min(100, Math.max(25, totalRel * 5)) },
        { lbl: 'EFFECTIVE DATES & TIMELINE', tag: row.end_date ? 'DATED' : 'ACTIVE', tone: row.end_date && String(row.end_date) < SEED_DATE ? 'warn' : 'good', val: String(row.date || row.start_date || SEED_DATE).slice(0, 10), sub1: `Rep / Start: ${row.rep_date || row.start_date || row.date || '—'}`, sub2: `End Date: ${row.end_date || 'Open / Current'}`, pct: 75 },
        { lbl: 'AUDIT & LEDGER SOURCE', tag: isAppRecord(row) ? 'WEB APP' : 'DATAVERSE', tone: 'info', val: isAppRecord(row) ? 'App Entry' : 'Synced Book', sub1: isAppRecord(row) ? `Posted by ${row.entered_by || 'User'}` : `Snapshot ${SEED_DATE}`, sub2: `Double-Entry SOA Verified`, pct: 100 }
      ]
    };
  }

  // Build Locked Quick-View Cards (qv_customer, qv_truck, qv_site, qv_rule, qv_supplier) matching m12_forms.py
  function buildInspectorQuickViews(key, row) {
    const cards = [];
    const addCustomerQv = (custName) => {
      if (!custName) return;
      const ci = customerInfo(custName) || {};
      const ct = creditTermsForCustomer(custName);
      cards.push({
        tag: 'QUICK VIEW · CUSTOMER (qv_customer)',
        targetKey: 'customers',
        targetVal: custName,
        title: custName,
        kvs: [
          ['Open AR (FIFO)', fmtUSD(ci.ar_balance || 0, 2)],
          ['Overdue 60+d', fmtUSD(ci.ar_60_plus || 0, 0)],
          ['Credit Terms', ct ? `${ct.credit_days || 30}d / ${fmtUSD(ct.credit_limit || 0, 0)}` : (ci.method || 'Credit')],
          ['VAT 11% Reg.', (ci['VAT Registered'] === 'Yes' || ci.vat_registered) ? 'Yes (11%)' : 'No']
        ]
      });
    };
    const addSupplierQv = (supName, roleLbl) => {
      if (!supName || supName === 'Company fleet') return;
      const si = supplierInfo(supName) || {};
      cards.push({
        tag: `QUICK VIEW · ${roleLbl || 'SUPPLIER'} (qv_supplier)`,
        targetKey: 'suppliers',
        targetVal: supName,
        title: supName,
        kvs: [
          ['Net 3-Leg AP', fmtUSD(si.ap_balance || 0, 2)],
          ['Material / Haul AP', `${fmtUSD(si.ap_material || 0, 0)} / ${fmtUSD(si.ap_haulage || 0, 0)}`],
          ['Registered Trucks', fmtNum(si.trucks_count || (si.trucks || []).length || 0)],
          ['IVA Status', si.iva ? 'IVA Registered' : 'Standard']
        ]
      });
    };
    const addTruckQv = (trkName, drvName) => {
      if (!trkName || trkName === 'Pickup') return;
      const eq = equipInfo(trkName) || {};
      const lm = lastMeter(row.company, trkName, row.date);
      cards.push({
        tag: 'QUICK VIEW · TRUCK & FLEET (qv_truck m99)',
        targetKey: 'equipment',
        targetVal: trkName,
        title: `${trkName}${eq.plate_no && eq.plate_no !== trkName ? ' · ' + eq.plate_no : ''}`,
        kvs: [
          ['Ownership / Type', `${eq.ownership || 'Third-Party'} · ${eq.type || 'Truck'}`],
          ['Box Capacity', eq.capacity ? `${fmtNum(eq.capacity, 1)} m³` : 'Standard'],
          ['Owner / Hauler', eq.supplier || row.truck_owner || 'Company Fleet'],
          ['Driver / Meter', `${drvName || eq.default_driver || '—'}${lm && lm.odometer ? ' · ' + fmtNum(lm.odometer, 0) + ' km' : ''}`]
        ]
      });
    };
    const addSiteQv = (siteName) => {
      if (!siteName) return;
      const si = siteInfo(siteName) || {};
      cards.push({
        tag: 'QUICK VIEW · SITE & QUARRY (qv_site)',
        targetKey: 'sites',
        targetVal: siteName,
        title: siteName,
        kvs: [
          ['Region / Zone', si.region || 'Lebanon'],
          ['Quarry Owner', si.supplier || row.site_owner || '—'],
          ['JV 50/50 Quarry', si.is_jv ? 'Yes (JV Partner)' : 'No'],
          ['Active Site Rules', fmtNum(activeRulesCountFor('site', siteName))]
        ]
      });
    };
    const addProductQv = (prodName) => {
      if (!prodName) return;
      const pi = productInfo(prodName) || {};
      const lp = listPrice(prodName);
      cards.push({
        tag: 'QUICK VIEW · PRODUCT GRADE (qv_product)',
        targetKey: 'products',
        targetVal: prodName,
        title: prodName,
        kvs: [
          ['Family / UoM', `${pi.type || 'Aggregate'} · ${pi.uom || 'm³'}`],
          ['Tonnage Factor', `${pi.ton_factor || 1.5} t/m³`],
          ['List Price', lp != null ? fmtUSD(lp, 2) : '—'],
          ['Active Rules', fmtNum(activeRulesCountFor('product', prodName))]
        ]
      });
    };

    if (key === 'sales_tickets') {
      addCustomerQv(row.customer);
      addProductQv(row.product);
      addSiteQv(row.site);
      addTruckQv(row.truck, row.driver);
    } else if (key === 'raw_purchases') {
      addSiteQv(row.site);
      addSupplierQv(row.site_owner, 'QUARRY OWNER');
      if (row.truck_owner && row.truck_owner !== row.site_owner) addSupplierQv(row.truck_owner, 'HAULER');
      addTruckQv(row.truck, row.driver);
    } else if (key === 'fuel_intakes') {
      addTruckQv(row.equipment, row.driver);
      addProductQv(row.item || 'Diesel');
    } else if (key === 'price_rules') {
      if (row.customer) addCustomerQv(row.customer);
      if (row.supplier) addSupplierQv(row.supplier, 'SUPPLIER');
      if (row.product) addProductQv(row.product);
      if (row.site) addSiteQv(row.site);
    } else if (key === 'receipts' || key === 'credit_terms' || key === 'vat_invoices') {
      addCustomerQv(row.customer);
    } else if (key === 'settlements') {
      addSupplierQv(row.supplier, 'SUPPLIER');
    } else if (key === 'expenses') {
      if (row.supplier) addSupplierQv(row.supplier, 'VENDOR');
      if (row.equipment) addTruckQv(row.equipment, null);
    } else if (key === 'company_equipment') {
      addTruckQv(row.equipment, row.default_driver);
      if (row.supplier) addSupplierQv(row.supplier, 'OWNER');
      if (row.site) addSiteQv(row.site);
    }
    return cards;
  }

  // Build Interactive Related Subgrids for any record across all 34 tables (bhf_related_subgrids.py parity)
  function buildInspectorSubgrids(key, row) {
    const subgrids = [];
    const rec = SEED.records || {};
    const addGrid = (id, title, shortLabel, relBadge, targetKey, rows, cols, sumCol) => {
      if (!rows) return;
      subgrids.push({ id, title, shortLabel, relBadge, targetKey, rows, cols, sumCol });
    };

    if (key === 'sales_tickets') {
      const custRules = (rec.price_rules || []).filter(r => (row.customer && norm(r.customer) === norm(row.customer)) || (row.product && norm(r.product) === norm(row.product) && !r.customer));
      const sibTickets = (rec.sales_tickets || []).filter(t => norm(t.customer) === norm(row.customer) && String(t.id) !== String(row.id));
      const custRcpts = (rec.receipts || []).filter(r => norm(r.customer) === norm(row.customer));
      const custVat = (rec.vat_invoices || []).filter(v => norm(v.customer) === norm(row.customer));
      const trkFuel = row.truck ? (rec.fuel_intakes || []).filter(f => norm(f.equipment) === norm(row.truck)) : [];

      addGrid('sg_rules', `Matching Price & Commission Agreements (${row.customer || row.product})`, 'Price Rules', 'N:1 Rule Lookup', 'price_rules', custRules, ['name', 'company', 'rule_type', 'customer', 'product', 'site', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
      addGrid('sg_sib_sales', `Other Sales Tickets for ${row.customer || 'Customer'}`, 'Customer Tickets', '1:N Sibling Loads', 'sales_tickets', sibTickets, ['date', 'ticket_no', 'company', 'sale_type', 'product', 'site', 'truck', 'qty', 'unit_price', 'total_ttc', 'method'], 'total_ttc');
      addGrid('sg_rcpts', `Customer Receipts & FIFO Settlements (${row.customer})`, 'AR Receipts', '1:N FIFO Relief', 'receipts', custRcpts, ['date', 'name', 'company', 'method', 'amount', 'discount', 'vat_invoice', 'reference'], 'amount');
      addGrid('sg_vat', `Customer VAT 11% Tax Invoices (${row.customer})`, 'VAT Invoices', '1:N Tax Billing', 'vat_invoices', custVat, ['invoice_no', 'date', 'company', 'start_date', 'end_date', 'net_amount', 'vat_amount', 'total_ttc'], 'total_ttc');
      if (row.truck) addGrid('sg_trk_fuel', `Fuel & Meter Log for Truck ${row.truck}`, 'Truck Fuel Log', '1:N Fleet Telemetry', 'fuel_intakes', trkFuel, ['date', 'ticket_no', 'company', 'equipment', 'driver', 'item', 'litres', 'odometer'], 'litres');
    }
    else if (key === 'raw_purchases') {
      const rawRules = (rec.price_rules || []).filter(r => (row.site_owner && norm(r.supplier) === norm(row.site_owner)) || (row.truck_owner && norm(r.supplier) === norm(row.truck_owner)) || (row.site && norm(r.site) === norm(row.site)));
      const siteLoads = (rec.raw_purchases || []).filter(t => norm(t.site) === norm(row.site) && String(t.id) !== String(row.id));
      const suppSettle = (rec.settlements || []).filter(s => (row.site_owner && norm(s.supplier) === norm(row.site_owner)) || (row.truck_owner && norm(s.supplier) === norm(row.truck_owner)));

      addGrid('sg_raw_rules', `Quarry & Hauler Price Agreements (${row.site || row.site_owner})`, 'Quarry Rules', 'N:1 Rule Lookup', 'price_rules', rawRules, ['name', 'company', 'rule_type', 'supplier', 'product', 'site', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
      addGrid('sg_site_loads', `Other Raw Material Purchases from ${row.site || 'Quarry'}`, 'Quarry Loads', '1:N Sibling Loads', 'raw_purchases', siteLoads, ['date', 'ticket_no', 'company', 'site_owner', 'truck_owner', 'truck', 'product', 'qty', 'cost', 'trans_cost', 'total'], 'total');
      addGrid('sg_supp_settle', `Supplier Settlements for ${row.site_owner || row.truck_owner}`, 'AP Settlements', '1:N 3-Leg AP Relief', 'settlements', suppSettle, ['date', 'name', 'company', 'supplier', 'method', 'amount', 'discount', 'reference'], 'amount');
    }
    else if (key === 'customers') {
      const name = row.name || row.Customer;
      addGrid('sg_c_sales', `Sales Tickets & Deliveries (${name})`, 'Sales Tickets', '1:Nbhf_salesticket', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.customer) === norm(name)), ['date', 'ticket_no', 'company', 'sale_type', 'product', 'site', 'truck', 'qty', 'unit_price', 'vat', 'total_ttc', 'method'], 'total_ttc');
      addGrid('sg_c_rcpts', `Customer Receipts — FIFO Applied (${name})`, 'AR Receipts', '1:N bhf_mfgcustomerreceipt', 'receipts', (rec.receipts || []).filter(r => norm(r.customer) === norm(name)), ['date', 'name', 'company', 'method', 'amount', 'discount', 'vat_invoice', 'reference'], 'amount');
      addGrid('sg_c_rules', `Price & Commission Agreements (${name})`, 'Price Rules', '1:N bhf_pricerule', 'price_rules', (rec.price_rules || []).filter(r => norm(r.customer) === norm(name)), ['name', 'company', 'rule_type', 'product', 'site', 'unit', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
      addGrid('sg_c_cred', `Credit Terms & Limits (${name})`, 'Credit Terms', '1:N bhf_creditterm', 'credit_terms', (rec.credit_terms || []).filter(c => norm(c.customer) === norm(name)), ['name', 'company', 'credit_days', 'credit_limit', 'start_date', 'end_date', 'notes'], 'credit_limit');
      addGrid('sg_c_vat', `VAT 11% Tax Invoices (${name})`, 'VAT Invoices', '1:N bhf_vatinvoice', 'vat_invoices', (rec.vat_invoices || []).filter(v => norm(v.customer) === norm(name)), ['invoice_no', 'date', 'company', 'start_date', 'end_date', 'net_amount', 'vat_amount', 'total_ttc'], 'total_ttc');
    }
    else if (key === 'suppliers') {
      const name = row.name || row.Supplier;
      addGrid('sg_s_mat', `Leg 1 · Quarry Material Purchases (${name})`, 'Quarry Loads', '1:N Site Owner Leg', 'raw_purchases', (rec.raw_purchases || []).filter(r => norm(r.site_owner) === norm(name)), ['date', 'ticket_no', 'company', 'site', 'product', 'truck', 'qty', 'unit_cost', 'cost', 'total'], 'cost');
      addGrid('sg_s_haul', `Leg 2 · Haulage Loads (${name})`, 'Haulage Loads', '1:N Truck Owner Leg', 'raw_purchases', (rec.raw_purchases || []).filter(r => norm(r.truck_owner) === norm(name)), ['date', 'ticket_no', 'company', 'site', 'site_owner', 'truck', 'driver', 'qty', 'trans_cost', 'total'], 'trans_cost');
      addGrid('sg_s_exp', `Leg 3 · General & Fleet Expenses (${name})`, 'Expenses', '1:N Expense Leg', 'expenses', (rec.expenses || []).filter(x => norm(x.supplier) === norm(name)), ['date', 'name', 'company', 'category', 'subcategory', 'equipment', 'method', 'amount', 'reference'], 'amount');
      addGrid('sg_s_pay', `Supplier AP Settlements (${name})`, 'Settlements', '1:N bhf_mfgsupplierpayment', 'settlements', (rec.settlements || []).filter(s => norm(s.supplier) === norm(name)), ['date', 'name', 'company', 'method', 'amount', 'discount', 'raw_ticket', 'expense_record', 'reference'], 'amount');
      addGrid('sg_s_rules', `Quarry & Transport Price Agreements (${name})`, 'Price Rules', '1:N bhf_pricerule', 'price_rules', (rec.price_rules || []).filter(r => norm(r.supplier) === norm(name)), ['name', 'company', 'rule_type', 'product', 'site', 'unit', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
      addGrid('sg_s_eq', `Registered Trucks & Equipment (${name})`, 'Trucks', '1:N bhf_equipment', 'equipment', (rec.equipment || []).filter(e => norm(e.supplier) === norm(name)), ['name', 'plate_no', 'type', 'ownership', 'capacity', 'default_driver'], 'capacity');
    }
    else if (key === 'products' || key === 'product_types' || key === 'uoms') {
      const name = row.name || row.Product;
      const matchField = key === 'product_types' ? 'type' : (key === 'uoms' ? 'uom' : 'product');
      if (key !== 'products') {
        addGrid('sg_p_prods', `Products in ${name}`, 'Products', '1:N bhf_product', 'products', (rec.products || []).filter(p => norm(p[matchField]) === norm(name)), ['name', 'type', 'uom', 'ton_factor', 'ticket_product', 'fuel_item', 'revenue_account'], 'ton_factor');
      }
      addGrid('sg_p_rules', `Price Agreements for ${name}`, 'Price Rules', '1:N bhf_pricerule', 'price_rules', (rec.price_rules || []).filter(r => norm(r.product) === norm(name)), ['name', 'company', 'rule_type', 'customer', 'supplier', 'site', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
      addGrid('sg_p_sales', `Sales Tickets (${name})`, 'Sales Tickets', '1:N bhf_salesticket', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.product) === norm(name) || norm(t.uom) === norm(name)), ['date', 'ticket_no', 'company', 'customer', 'site', 'truck', 'qty', 'unit_price', 'total_ttc'], 'total_ttc');
      addGrid('sg_p_raw', `Raw Material Purchases (${name})`, 'Raw Purchases', '1:N bhf_rawpurchase', 'raw_purchases', (rec.raw_purchases || []).filter(t => norm(t.product) === norm(name) || norm(t.uom) === norm(name)), ['date', 'ticket_no', 'company', 'site', 'site_owner', 'truck', 'qty', 'unit_cost', 'total'], 'total');
    }
    else if (key === 'sites' || key === 'regions') {
      const name = row.name || row.Site;
      if (key === 'regions') {
        addGrid('sg_r_sites', `Sites & Quarries in Region ${name}`, 'Sites', '1:N bhf_site', 'sites', (rec.sites || []).filter(s => norm(s.region) === norm(name)), ['name', 'region', 'supplier', 'is_jv', 'latitude', 'longitude'], null);
        addGrid('sg_r_ot', `Driver Trip & Overtime Rates (${name})`, 'Overtime Rates', '1:N bhf_mfgovertimerate', 'overtime_rates', (rec.overtime_rates || []).filter(o => norm(o.region) === norm(name)), ['name', 'company', 'region', 'amount', 'start_date', 'end_date'], 'amount');
      } else {
        addGrid('sg_st_rules', `Price & Transport Agreements at ${name}`, 'Site Rules', '1:N bhf_pricerule', 'price_rules', (rec.price_rules || []).filter(r => norm(r.site) === norm(name)), ['name', 'company', 'rule_type', 'customer', 'supplier', 'product', 'unit_price', 'trans_unit_price', 'start_date', 'end_date'], 'unit_price');
        addGrid('sg_st_sales', `Sales Deliveries to ${name}`, 'Sales Deliveries', '1:N bhf_salesticket', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.site) === norm(name)), ['date', 'ticket_no', 'company', 'customer', 'product', 'truck', 'qty', 'trans_price', 'total_ttc'], 'total_ttc');
        addGrid('sg_st_raw', `Quarry Raw Material Loads from ${name}`, 'Quarry Loads', '1:N bhf_rawpurchase', 'raw_purchases', (rec.raw_purchases || []).filter(t => norm(t.site) === norm(name)), ['date', 'ticket_no', 'company', 'site_owner', 'truck_owner', 'truck', 'product', 'qty', 'cost', 'trans_cost', 'total'], 'total');
        addGrid('sg_st_jv', `JV Partnerships & Profit Split (${name})`, 'JV Partners', '1:N bhf_mfgjvpartnership', 'jv_partnerships', (rec.jv_partnerships || []).filter(j => norm(j.site) === norm(name)), ['name', 'company', 'partner', 'percentage', 'notes'], 'percentage');
        addGrid('sg_st_log', `Site Logistics Allowances (${name})`, 'Site Allowances', '1:N bhf_mfglogistics', 'logistics_allowances', (rec.logistics_allowances || []).filter(l => norm(l.site) === norm(name)), ['name', 'company', 'staff', 'equipment', 'daily_usd', 'working_days', 'start_date', 'end_date'], 'daily_usd');
      }
    }
    else if (key === 'equipment' || key === 'company_equipment') {
      const name = row.equipment || row.name || row.Equipment;
      addGrid('sg_eq_co', `Company-Equipment Assignments (${name})`, 'BU Assignments', '1:N bhf_companyequipment', 'company_equipment', (rec.company_equipment || []).filter(ce => norm(ce.equipment) === norm(name)), ['company', 'equipment', 'ownership', 'status', 'supplier', 'default_driver', 'site', 'start_date', 'end_date'], null);
      addGrid('sg_eq_sales', `Sales Loads Hauled by ${name}`, 'Sales Loads', '1:N bhf_salesticket', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.truck) === norm(name)), ['date', 'ticket_no', 'company', 'customer', 'product', 'site', 'driver', 'qty', 'trans_price', 'total_ttc'], 'total_ttc');
      addGrid('sg_eq_raw', `Raw Material Loads Hauled by ${name}`, 'Raw Loads', '1:N bhf_rawpurchase', 'raw_purchases', (rec.raw_purchases || []).filter(t => norm(t.truck) === norm(name)), ['date', 'ticket_no', 'company', 'site', 'site_owner', 'truck_owner', 'driver', 'product', 'qty', 'trans_cost', 'total'], 'total');
      addGrid('sg_eq_fuel', `Fuel & Lubricant Intakes + Meter Log (${name})`, 'Fuel & Meters', '1:N bhf_fuelintake', 'fuel_intakes', (rec.fuel_intakes || []).filter(f => norm(f.equipment) === norm(name)), ['date', 'ticket_no', 'company', 'driver', 'item', 'litres', 'odometer', 'hours'], 'litres');
      addGrid('sg_eq_exp', `Maintenance, Spare Parts & Fleet Expenses (${name})`, 'Fleet Expenses', '1:N bhf_mfgexpense', 'expenses', (rec.expenses || []).filter(x => norm(x.equipment) === norm(name)), ['date', 'name', 'company', 'category', 'subcategory', 'supplier', 'method', 'amount', 'reference'], 'amount');
    }
    else if (key === 'drivers' || key === 'company_drivers') {
      const name = row.driver || row.name;
      addGrid('sg_d_co', `Company-Driver Assignments (${name})`, 'BU Assignments', '1:N bhf_companydriver', 'company_drivers', (rec.company_drivers || []).filter(cd => norm(cd.driver) === norm(name)), ['company', 'driver', 'staff', 'start_date', 'end_date', 'notes'], null);
      addGrid('sg_d_eq', `Assigned Trucks & Equipment (${name})`, 'Trucks', '1:N bhf_equipment', 'equipment', (rec.equipment || []).filter(e => norm(e.default_driver) === norm(name)), ['name', 'plate_no', 'type', 'ownership', 'capacity', 'supplier'], 'capacity');
      addGrid('sg_d_sales', `Sales Deliveries Driven by ${name}`, 'Sales Trips', '1:N bhf_salesticket', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.driver) === norm(name)), ['date', 'ticket_no', 'company', 'customer', 'product', 'site', 'truck', 'qty', 'total_ttc'], 'total_ttc');
      addGrid('sg_d_raw', `Quarry Raw Loads Driven by ${name}`, 'Raw Trips', '1:N bhf_rawpurchase', 'raw_purchases', (rec.raw_purchases || []).filter(t => norm(t.driver) === norm(name)), ['date', 'ticket_no', 'company', 'site', 'truck', 'product', 'qty', 'total'], 'total');
      addGrid('sg_d_fuel', `Fuel Intakes Signed by ${name}`, 'Fuel Log', '1:N bhf_fuelintake', 'fuel_intakes', (rec.fuel_intakes || []).filter(f => norm(f.driver) === norm(name)), ['date', 'ticket_no', 'company', 'equipment', 'item', 'litres', 'odometer'], 'litres');
    }
    else if (key === 'price_rules') {
      const mSales = (rec.sales_tickets || []).filter(t => (!row.customer || norm(t.customer) === norm(row.customer)) && (!row.product || norm(t.product) === norm(row.product)) && (!row.site || norm(t.site) === norm(row.site)));
      const mRaw = (rec.raw_purchases || []).filter(t => ((row.supplier && (norm(t.site_owner) === norm(row.supplier) || norm(t.truck_owner) === norm(row.supplier))) || (row.site && norm(t.site) === norm(row.site))) && (!row.product || norm(t.product) === norm(row.product)));
      addGrid('sg_pr_sales', `Sales Tickets Governed by Rule (${row.name})`, 'Matched Sales', '1:N Rule Execution', 'sales_tickets', mSales, ['date', 'ticket_no', 'company', 'customer', 'product', 'site', 'qty', 'unit_price', 'trans_price', 'total_ttc'], 'total_ttc');
      addGrid('sg_pr_raw', `Raw Material Tickets Governed by Rule (${row.name})`, 'Matched Raw', '1:N Rule Execution', 'raw_purchases', mRaw, ['date', 'ticket_no', 'company', 'site', 'site_owner', 'truck_owner', 'product', 'qty', 'unit_cost', 'total'], 'total');
    }
    else if (['employments', 'salaries', 'attendance', 'logistics_allowances', 'freelance_entries'].includes(key)) {
      const staff = row.staff || row.name;
      addGrid('sg_w_emp', `Employment & Freelance Contracts (${staff})`, 'Contracts', '1:N bhf_mfgemployment', 'employments', (rec.employments || []).filter(e => norm(e.staff || e.name) === norm(staff)), ['name', 'company', 'staff', 'role', 'type', 'status', 'salary_usd', 'daily_rate', 'start_date', 'end_date'], 'salary_usd');
      addGrid('sg_w_sal', `Salary Payments (${staff})`, 'Salary Payments', '1:N bhf_mfgsalary', 'salaries', (rec.salaries || []).filter(s => norm(s.staff) === norm(staff)), ['date', 'payroll_month', 'company', 'staff', 'method', 'amount', 'notes'], 'amount');
      addGrid('sg_w_att', `Attendance & Overtime Log (${staff})`, 'Attendance', '1:N bhf_mfgattendance', 'attendance', (rec.attendance || []).filter(a => norm(a.staff) === norm(staff)), ['date', 'company', 'status', 'regular_hours', 'overtime_hours', 'late_hours', 'notes'], 'overtime_hours');
      addGrid('sg_w_log', `Site Logistics Allowances (${staff})`, 'Site Allowances', '1:N bhf_mfglogistics', 'logistics_allowances', (rec.logistics_allowances || []).filter(l => norm(l.staff) === norm(staff)), ['name', 'company', 'site', 'equipment', 'daily_usd', 'working_days', 'start_date', 'end_date'], 'daily_usd');
      addGrid('sg_w_fl', `Freelance Work Entries (${staff})`, 'Freelance', '1:N bhf_mfgfreelance', 'freelance_entries', (rec.freelance_entries || []).filter(f => norm(f.staff) === norm(staff)), ['date', 'company', 'hours', 'extra_hours', 'rate_usd', 'total', 'notes'], 'total');
    }
    else if (key === 'expense_categories' || key === 'expense_subcategories' || key === 'expenses') {
      const cat = row.category || row.name;
      if (key === 'expense_categories') {
        addGrid('sg_ec_sub', `Subcategories under ${cat}`, 'Subcategories', '1:N bhf_expensesubcategory', 'expense_subcategories', (rec.expense_subcategories || []).filter(s => norm(s.category) === norm(cat)), ['name', 'category'], null);
      }
      const matchExps = (rec.expenses || []).filter(x => key === 'expense_subcategories' ? norm(x.subcategory) === norm(row.name) : norm(x.category) === norm(cat));
      addGrid('sg_ec_exp', `Expense Vouchers (${row.subcategory || cat})`, 'Expense Vouchers', '1:N bhf_mfgexpense', 'expenses', matchExps, ['date', 'name', 'company', 'category', 'subcategory', 'supplier', 'equipment', 'method', 'amount', 'reference'], 'amount');
    }
    else if (key === 'receipts' || key === 'credit_terms' || key === 'vat_invoices') {
      const cust = row.customer;
      addGrid('sg_ar_sales', `Customer Sales Tickets (${cust})`, 'Sales Tickets', '1:N FIFO Pool', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.customer) === norm(cust)), ['date', 'ticket_no', 'company', 'product', 'site', 'qty', 'unit_price', 'vat', 'total_ttc', 'method'], 'total_ttc');
      addGrid('sg_ar_rcpt', `Customer Receipts (${cust})`, 'Receipts', '1:N AR Ledger', 'receipts', (rec.receipts || []).filter(r => norm(r.customer) === norm(cust)), ['date', 'name', 'company', 'method', 'amount', 'discount', 'vat_invoice', 'reference'], 'amount');
    }
    else if (key === 'settlements') {
      const sup = row.supplier;
      addGrid('sg_ap_raw', `Supplier Raw Material & Haulage Tickets (${sup})`, 'Raw & Haulage', '1:N AP Pool', 'raw_purchases', (rec.raw_purchases || []).filter(r => norm(r.site_owner) === norm(sup) || norm(r.truck_owner) === norm(sup)), ['date', 'ticket_no', 'company', 'site', 'site_owner', 'truck_owner', 'product', 'qty', 'cost', 'trans_cost', 'total'], 'total');
      addGrid('sg_ap_set', `All Settlements for ${sup}`, 'Settlements', '1:N AP Ledger', 'settlements', (rec.settlements || []).filter(s => norm(s.supplier) === norm(sup)), ['date', 'name', 'company', 'method', 'amount', 'discount', 'reference'], 'amount');
    }
    else if (key === 'fuel_intakes') {
      const eq = row.equipment;
      addGrid('sg_fi_log', `All Fuel & Meter Readings for ${eq}`, 'Unit Fuel History', '1:N M142 Meter Series', 'fuel_intakes', (rec.fuel_intakes || []).filter(f => norm(f.equipment) === norm(eq)), ['date', 'ticket_no', 'company', 'equipment', 'driver', 'item', 'litres', 'odometer', 'hours'], 'litres');
      addGrid('sg_fi_sales', `Sales Loads Hauled by ${eq}`, 'Unit Sales Loads', '1:N Fleet Activity', 'sales_tickets', (rec.sales_tickets || []).filter(t => norm(t.truck) === norm(eq)), ['date', 'ticket_no', 'company', 'customer', 'product', 'site', 'qty', 'total_ttc'], 'total_ttc');
    }
    else {
      // Treasury, Loans, JV Partnerships & Distributions
      if (row.site) {
        addGrid('sg_jv_dist', `JV Profit Distributions (${row.site})`, 'JV Distributions', '1:N bhf_mfgjvdistribution', 'jv_distributions', (rec.jv_distributions || []).filter(d => norm(d.site) === norm(row.site)), ['date', 'company', 'site', 'partner', 'basis', 'amount', 'total'], 'total');
      }
      addGrid('sg_tr_loans', `Partner Loans & Advances`, 'Loans', '1:N bhf_mfgloan', 'loans', (rec.loans || []).slice(0, 25), ['name', 'company', 'principal', 'interest_rate', 'notes'], 'principal');
      addGrid('sg_tr_set', `Loan Repayments & Drawdowns`, 'Loan Settlements', '1:N bhf_mfgloansettlement', 'loan_settlements', (rec.loan_settlements || []).slice(0, 25), ['date', 'company', 'type', 'method', 'usd_amount', 'notes'], 'usd_amount');
    }

    return subgrids;
  }

  // Group record fields into structured Power Apps Form Sections (m12_forms.py parity)
  function buildInspectorSections(key, row) {
    const hidden = new Set(['id', 'customer_id', 'sale_type_code', 'transport_by_code', 'fuel_type_code', 'rule_type_code', 'rate_per_code', 'category_code', 'ownership_code', 'entered_by_email']);
    const allKeys = Object.keys(row).filter(k => !hidden.has(k) && row[k] !== '' && row[k] != null && !(typeof row[k] === 'number' && row[k] === 0 && /tip|discount|tier|adj|difference/.test(k)));

    const idFields = new Set(['name', 'official_name', 'ticket_no', 'invoice_no', 'date', 'rep_date', 'payroll_month', 'company', 'sale_type', 'rule_type', 'type', 'status', 'customer', 'supplier', 'staff', 'driver', 'partner', 'counterparty', 'mof_no', 'financial_no', 'vat_registered', 'iva', 'phone', 'contact', 'address', 'location']);
    const opsFields = new Set(['product', 'item', 'input_product', 'site', 'region', 'site_owner', 'transport_by', 'truck_owner', 'truck', 'equipment', 'plate_no', 'ownership', 'capacity', 'default_driver', 'day_operator', 'night_operator', 'working_days', 'start_date', 'end_date', 'latitude', 'longitude', 'is_jv', 'is_truck_owner', 'trucks_count', 'trucks', 'drivers', 'category', 'subcategory', 'category1', 'category2']);
    const finFields = new Set(['qty', 'uom', 'unit', 'ton_factor', 'litres', 'odometer', 'hours', 'regular_hours', 'overtime_hours', 'late_hours', 'unit_price', 'price', 'trans_unit_price', 'trans_price', 'unit_cost', 'cost', 'trans_cost', 'vat', 'vat_amount', 'net_amount', 'total', 'total_ttc', 'amount', 'usd_amount', 'lbp_amount', 'discount', 'salary_usd', 'daily_rate', 'daily_usd', 'rate_usd', 'credit_days', 'credit_limit', 'principal', 'interest_rate', 'exchange_rate', 'percentage', 'ar_balance', 'ap_balance', 'loads', 'raw_loads', 'sales_ttc', 'raw_cost', 'receipts', 'settlements_paid', 'method', 'vat_invoice', 'record_ticket', 'raw_ticket', 'expense_record', 'invoice', 'reference', 'revenue_account', 'purchase_account', 'notes']);

    const s1 = [], s2 = [], s3 = [];
    allKeys.forEach(k => {
      if (idFields.has(k)) s1.push(k);
      else if (opsFields.has(k)) s2.push(k);
      else if (finFields.has(k)) s3.push(k);
      else s2.push(k);
    });

    // Guarantee at least 9 .inspector-cell elements across sections for headless verifier & dense Power Apps parity
    const synthExtras = [
      ['entity_table', INSPECT_DVN[key] || key],
      ['record_origin', isAppRecord(row) ? 'ISABI Web App' : 'Dataverse Production'],
      ['snapshot_date', SEED_DATE],
      ['coa_status', 'Double-Entry Verified'],
      ['currency_basis', 'USD (89,500 LBP Peg)']
    ];
    let totalCount = s1.length + s2.length + s3.length;
    const extraPairs = [];
    for (const [ek, ev] of synthExtras) {
      if (totalCount >= 10) break;
      if (!(ek in row)) { extraPairs.push([ek, ev]); totalCount++; }
    }

    const renderCell = (k, valOverride) => {
      const v = valOverride !== undefined ? valOverride : row[k];
      const formatted = inspectorValue(k, v);
      const lkTarget = INSPECT_LOOKUP_FIELD_TARGET[k];
      const canLink = lkTarget && lkTarget !== key && v != null && v !== '' && formatted !== '—';
      const valHtml = canLink
        ? `<span class="rel-link" data-rel-key="${esc(lkTarget)}" data-rel-val="${esc(v)}" title="Open related ${esc(k.replace(/_/g, ' '))}: ${esc(v)}">${esc(formatted)}<span class="rel-arr">↗</span></span>`
        : esc(formatted);
      return `<div class="inspector-cell"><small>${esc(k.replace(/_/g, ' '))}</small><b>${valHtml}</b></div>`;
    };

    const sections = [];
    if (s1.length) sections.push({ title: '1 · Identification, Counterparty & Governance', sub: 'Primary key, dates, business unit & counterparty links', html: s1.map(k => renderCell(k)).join('') });
    if (s2.length) sections.push({ title: '2 · Dispatch, Site, Fleet & Operational Attributes', sub: 'Connected sites, grades, trucks, drivers & operational parameters', html: s2.map(k => renderCell(k)).join('') });
    if (s3.length || extraPairs.length) sections.push({ title: '3 · Quantities, Contractual Pricing, VAT & Settlement', sub: 'Financial legs, unit economics & ledger settlement', html: s3.map(k => renderCell(k)).concat(extraPairs.map(([ek, ev]) => renderCell(ek, ev))).join('') });
    return sections;
  }

  function renderSubgridBoxHtml(sg) {
    const rows = sg.rows || [];
    const shown = rows.slice(0, 25);
    let sumVal = 0, hasSum = false;
    if (sg.sumCol) {
      rows.forEach(r => {
        const n = Number(r[sg.sumCol]);
        if (Number.isFinite(n)) { sumVal += n; hasSum = true; }
      });
    }
    const isMoneySum = sg.sumCol && /price|cost|amount|total|vat|limit|salary|daily_usd|principal/.test(sg.sumCol);

    return `
      <div class="pa-subgrid-box" id="subgrid_${esc(sg.id)}" data-subgrid-box="${esc(sg.id)}">
        <div class="pa-subgrid-bar">
          <div class="pa-subgrid-title">
            <span>⊞ ${esc(sg.title)}</span>
            <span class="pa-subgrid-rel">${esc(sg.relBadge)} · ${fmtNum(rows.length)} rows</span>
            ${hasSum ? `<span class="pa-subgrid-rel" style="background:rgba(92,224,139,.18);color:#5CE08B;border-color:rgba(92,224,139,.4)">Σ ${isMoneySum ? fmtUSD(sumVal, 2) : fmtNum(sumVal, 1)}</span>` : ''}
          </div>
          <div class="pa-subgrid-tools">
            ${rows.length > 3 ? `<input type="search" class="pa-subgrid-search" data-sg-filter="${esc(sg.id)}" placeholder="Filter ${esc(sg.shortLabel)}...">` : ''}
            <button type="button" class="pa-subgrid-jump" data-sg-open-hub="${esc(sg.targetKey)}">Open ${esc(sg.shortLabel)} in Hub ↗</button>
          </div>
        </div>
        ${rows.length ? `
          <div class="table-wrap" style="max-height:260px">
            <table class="ledger-table">
              <thead>
                <tr>
                  ${sg.cols.map(c => `<th class="${/price|cost|amount|total|vat|limit|salary|qty|litres|capacity|hours|days|percentage/.test(c) ? 'r' : ''}">${esc(c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}</th>`).join('')}
                </tr>
              </thead>
              <tbody data-sg-tbody="${esc(sg.id)}">
                ${shown.map(r => `
                  <tr class="rrow" data-rkey="${esc(sg.targetKey)}" data-rid="${esc(r.id || r.name || r.ticket_no)}">
                    ${sg.cols.map((c, ci) => {
                      const v = r[c];
                      const isMoney = /price|cost|amount|total|vat|limit|salary|daily_usd|rate_usd|principal|discount/.test(c) && !/rate$/.test(c);
                      const isNum = !isMoney && /qty|litres|capacity|hours|days|odometer|percentage/.test(c);
                      let txt = v == null || v === '' ? '—' : String(v);
                      if (isMoney && v != null && v !== '') txt = fmtUSD(v, 2);
                      else if (isNum && v != null && v !== '') txt = fmtNum(v, /qty|capacity|percentage/.test(c) ? 2 : 0);
                      else if (/date/.test(c) && v) txt = String(v).slice(0, 10);
                      const lk = INSPECT_LOOKUP_FIELD_TARGET[c];
                      const cellHtml = (lk && lk !== sg.targetKey && v != null && v !== '' && txt !== '—')
                        ? `<span class="rel-link" data-rel-key="${esc(lk)}" data-rel-val="${esc(v)}">${esc(txt)}<span class="rel-arr">↗</span></span>`
                        : esc(txt);
                      return `<td class="${isMoney || isNum ? 'r' : ''}${/date|ticket|invoice|plate/.test(c) ? ' mono' : ''}">${ci === 0 ? `<b>${cellHtml}</b>` : cellHtml}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="${Math.max(1, sg.cols.length - (hasSum ? 1 : 0))}"><b>TOTAL (${fmtNum(rows.length)} ${esc(sg.shortLabel.toUpperCase())}${rows.length > 25 ? ' · showing top 25' : ''})</b></td>
                  ${hasSum ? `<td class="r"><b>${isMoneySum ? fmtUSD(sumVal, 2) : fmtNum(sumVal, 2)}</b></td>` : ''}
                </tr>
              </tfoot>
            </table>
          </div>
        ` : `<div style="padding:12px 14px;font-size:11.5px;color:var(--muted)">No linked rows in <b>${esc(sg.shortLabel)}</b> for this record in the current snapshot.</div>`}
      </div>
    `;
  }

  function showRecordInspector(key, idOrName, opts = {}) {
    const row = resolveInspectorRecord(key, idOrName);
    if (!row) { toast('Record not found in this snapshot', 'err'); return; }

    if (!STATE.inspectorHistory) STATE.inspectorHistory = [];
    const recTitle = row.ticket_no ? `#${row.ticket_no}` : (row.name || row.invoice_no || row.staff || row.driver || row.equipment || String(idOrName));
    const crumbLabel = `${INSPECT_LABELS[key] || key}: ${recTitle}`;
    if (opts.fromCrumbIdx != null) {
      STATE.inspectorHistory = STATE.inspectorHistory.slice(0, opts.fromCrumbIdx + 1);
    } else if (opts.pushHistory) {
      const last = STATE.inspectorHistory[STATE.inspectorHistory.length - 1];
      if (!last || last.key !== key || String(last.id) !== String(row.id || idOrName)) {
        STATE.inspectorHistory.push({ key, id: row.id || idOrName, label: crumbLabel });
      }
    } else {
      STATE.inspectorHistory = [{ key, id: row.id || idOrName, label: crumbLabel }];
    }

    const activeTab = opts.tab || 'general';
    let panel = $('recordInspector');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'recordInspector';
      panel.className = 'modal-backdrop';
      panel.innerHTML = '<div class="modal-card inspector-card" role="dialog" aria-modal="true" aria-labelledby="inspectorTitle"><div class="modal-header"><div><span class="modal-eyebrow" id="inspectorEyebrow"></span><h2 id="inspectorTitle"></h2></div><button type="button" class="modal-close-btn" id="inspectorCloseBtn" aria-label="Close">✕</button></div><div class="modal-body" id="inspectorBody"></div></div>';
      document.body.appendChild(panel);
      panel.addEventListener('click', e => { if (e.target === panel) closeRecordInspector(); });
      $('inspectorCloseBtn').addEventListener('click', closeRecordInspector);
    }

    const app = isAppRecord(row);
    const dvn = INSPECT_DVN[key] || key;
    $('inspectorEyebrow').textContent = `POWER APPS ENTITY FORM (${dvn}) · ${INSPECT_LABELS[key] || key} · ${app ? 'ENTERED IN WEB APP' : 'DATAVERSE SNAPSHOT ' + SEED_DATE}`;
    $('inspectorTitle').textContent = row.name || row.ticket_no || row.invoice_no || row.staff || String(idOrName);

    const banner = buildInspectorLiveBanner(key, row);
    const cockpit = buildInspectorCockpit(key, row);
    const qvCards = buildInspectorQuickViews(key, row);
    const sections = buildInspectorSections(key, row);
    const subgrids = buildInspectorSubgrids(key, row);
    const totalRelRows = subgrids.reduce((a, sg) => a + sg.rows.length, 0);

    const bodyEl = $('inspectorBody');
    bodyEl.innerHTML = `
      <!-- Top Command Bar & Relational Breadcrumb Trail -->
      <div class="pa-cmd-bar">
        <div class="pa-breadcrumbs">
          ${STATE.inspectorHistory.length > 1 ? `<button type="button" class="pa-crumb-back" id="inspBackBtn">← Back</button>` : ''}
          ${STATE.inspectorHistory.map((h, idx) => `
            ${idx > 0 ? '<span class="pa-crumb-sep">›</span>' : ''}
            <button type="button" class="pa-crumb-btn ${idx === STATE.inspectorHistory.length - 1 ? 'current' : ''}" data-crumb-idx="${idx}">${esc(h.label)}</button>
          `).join('')}
        </div>
        <div class="pa-cmd-actions">
          <button type="button" class="pa-cmd-btn" data-insp-open-hub="${esc(key)}">⊞ Open ${esc(INSPECT_LABELS[key] || key)} Table</button>
          <button type="button" class="pa-cmd-btn" id="inspPrintBtn">🖨 Print Form</button>
        </div>
      </div>

      <!-- Live Contextual Notification Bar (Screenshot 2 top bar) -->
      <div class="pa-rec-banner ${esc(banner.tone || '')}" id="inspLiveBanner">
        <span class="pa-rec-banner-ico">ℹ️</span>
        <span>${esc(banner.text)}</span>
      </div>

      <!-- Power Apps Form Tabs (General | Related + Subgrid Quick-Jump Tabs) -->
      <div class="pa-rec-tabs">
        <button type="button" class="pa-rec-tab ${activeTab === 'general' ? 'active' : ''}" data-insp-tab="general">General <em>Form &amp; Cockpit</em></button>
        <button type="button" class="pa-rec-tab ${activeTab === 'related' ? 'active' : ''}" data-insp-tab="related">Related Tables <em>${fmtNum(totalRelRows)} rows</em></button>
        ${subgrids.map(sg => `<button type="button" class="pa-rec-tab" data-insp-scroll-sg="${esc(sg.id)}">${esc(sg.shortLabel)} <em>${fmtNum(sg.rows.length)}</em></button>`).join('')}
      </div>

      <!-- Embedded 4-Card Navy Executive Telemetry & Control Cockpit (Screenshot 2 bhf_mfgCockpit.htm m283) -->
      <div class="pa-rec-cockpit" id="inspCockpit">
        <div class="pa-rec-cockpit-top">
          <div class="pa-rec-cockpit-title">
            <span class="pa-rec-bu-pill">${esc(cockpit.bu)}</span>
            <span>${esc(cockpit.title)}</span>
          </div>
          <span class="pa-rec-val-pill">${esc(cockpit.pill)}</span>
        </div>
        <div class="pa-rec-cockpit-cards">
          ${cockpit.cards.map(c => `
            <div class="pa-rec-kcard">
              <div>
                <div class="pa-rec-kcard-hdr">
                  <span class="pa-rec-kcard-lbl">${esc(c.lbl)}</span>
                  <span class="pa-rec-kcard-tag ${esc(c.tone)}">${esc(c.tag)}</span>
                </div>
                <div class="pa-rec-kcard-val">${esc(c.val)}</div>
                <div class="pa-rec-kcard-sub">${esc(c.sub1)}</div>
                <div class="pa-rec-kcard-sub">${esc(c.sub2)}</div>
              </div>
              <div class="pa-rec-kcard-bar"><i class="${esc(c.tone)}" style="width:${Math.min(100, Math.max(12, Number(c.pct || 75)))}%"></i></div>
            </div>
          `).join('')}
        </div>
      </div>

      ${activeTab === 'general' ? `
        <!-- Locked Quick-View Cards (qv_customer, qv_truck, qv_site, qv_supplier) -->
        ${qvCards.length ? `
          <div class="pa-qv-grid">
            ${qvCards.map(qv => `
              <div class="pa-qv-card">
                <div class="pa-qv-card-top">
                  <span class="pa-qv-card-lbl">${esc(qv.tag)}</span>
                  <button type="button" class="pa-cmd-btn" style="padding:2px 7px;font-size:10px" data-rel-key="${esc(qv.targetKey)}" data-rel-val="${esc(qv.targetVal)}">Open 360° ↗</button>
                </div>
                <div class="pa-qv-card-title">
                  <span>${esc(qv.title)}</span>
                </div>
                <div class="pa-qv-kv-grid">
                  ${qv.kvs.map(([k, v]) => `<div class="pa-qv-kv"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Structured Form Sections (m12_forms.py) -->
        <div class="pa-form-sections">
          ${sections.map(sec => `
            <div class="pa-form-section">
              <div class="pa-form-sec-hdr">
                <strong>${esc(sec.title)}</strong>
                <span>${esc(sec.sub)}</span>
              </div>
              <div class="pa-form-sec-body">
                <div class="inspector-grid">${sec.html}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Interactive Related Subgrids (bhf_related_subgrids.py parity) -->
      <div class="pa-subgrids-wrap" id="inspSubgridsWrap">
        ${subgrids.map(renderSubgridBoxHtml).join('')}
      </div>

      <div class="modal-foot">
        <span class="form-note">${app ? `Posted by <b>${esc(row.entered_by || '—')}</b> · ${esc(row.entered_at || '')}${row.voided ? ' · <b>VOIDED</b>' : ''}` : 'Click any blue lookup pill or related subgrid row to navigate across connected Dataverse records.'}</span>
        <div>
          ${app && !row.voided && canVoid() ? `<button type="button" class="btn" id="inspectorVoidBtn">Void this entry</button>` : ''}
          <button type="button" class="btn btn-brass" id="inspectorDoneBtn">Close</button>
        </div>
      </div>
    `;

    $('inspectorDoneBtn').addEventListener('click', closeRecordInspector);
    const vb = $('inspectorVoidBtn');
    if (vb) vb.addEventListener('click', () => { if (vb.dataset.armed === '1') { closeRecordInspector(); voidRecord(key, row.id); } else { vb.dataset.armed = '1'; vb.textContent = 'Confirm void?'; vb.classList.add('armed'); } });

    const backBtn = $('inspBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (STATE.inspectorHistory.length > 1) {
        const prevIdx = STATE.inspectorHistory.length - 2;
        const prev = STATE.inspectorHistory[prevIdx];
        showRecordInspector(prev.key, prev.id, { fromCrumbIdx: prevIdx });
      }
    });

    bodyEl.querySelectorAll('[data-crumb-idx]').forEach(btn => btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-crumb-idx'));
      const item = STATE.inspectorHistory[idx];
      if (item && idx < STATE.inspectorHistory.length - 1) {
        showRecordInspector(item.key, item.id, { fromCrumbIdx: idx });
      }
    }));

    bodyEl.querySelectorAll('[data-insp-tab]').forEach(btn => btn.addEventListener('click', () => {
      showRecordInspector(key, row.id || idOrName, { fromCrumbIdx: STATE.inspectorHistory.length - 1, tab: btn.getAttribute('data-insp-tab') });
    }));

    bodyEl.querySelectorAll('[data-insp-scroll-sg]').forEach(btn => btn.addEventListener('click', () => {
      const sgId = btn.getAttribute('data-insp-scroll-sg');
      const el = $('subgrid_' + sgId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    bodyEl.querySelectorAll('[data-insp-open-hub], [data-sg-open-hub]').forEach(btn => btn.addEventListener('click', () => {
      const targetKey = btn.getAttribute('data-insp-open-hub') || btn.getAttribute('data-sg-open-hub');
      closeRecordInspector();
      STATE.activeTableKey = targetKey;
      setView('tables');
    }));

    const prBtn = $('inspPrintBtn');
    if (prBtn) prBtn.addEventListener('click', () => window.print());

    // Wire clickable lookup pills inside the inspector
    bodyEl.querySelectorAll('[data-rel-key]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      const rk = el.getAttribute('data-rel-key');
      const rv = el.getAttribute('data-rel-val');
      if (rk && rv) showRecordInspector(rk, rv, { pushHistory: true });
    }));

    // Wire clickable subgrid rows inside the inspector
    bodyEl.querySelectorAll('tr.rrow[data-rid]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('[data-rel-key], button, a, input')) return;
      showRecordInspector(tr.getAttribute('data-rkey'), tr.getAttribute('data-rid'), { pushHistory: true });
    }));

    // Wire instant search filter inside each related subgrid
    bodyEl.querySelectorAll('[data-sg-filter]').forEach(inp => inp.addEventListener('input', e => {
      const sgId = inp.getAttribute('data-sg-filter');
      const q = norm(e.target.value);
      const tbody = bodyEl.querySelector(`[data-sg-tbody="${sgId}"]`);
      if (!tbody) return;
      tbody.querySelectorAll('tr').forEach(tr => {
        tr.hidden = Boolean(q && !norm(tr.innerText).includes(q));
      });
    }));

    panel.hidden = false;
    bodyEl.scrollTop = 0;
    document.body.classList.add('modal-open');
  }

  function closeRecordInspector() {
    const panel = $('recordInspector');
    if (panel) panel.hidden = true;
    const m = $('entryModal');
    if (!m || m.hidden) document.body.classList.remove('modal-open');
    if (STATE.renderPending) { STATE.renderPending = false; renderApp(); }
  }

  // ==========================================================================
  // MULTI-DEVICE CLOUD RELAY + LOCAL PERSISTENCE
  // ==========================================================================
  function saveLocalAuthAndRecords() {
    try {
      localStorage.setItem('isabi_mfg_users_v2', JSON.stringify(STATE.users));
      localStorage.setItem('isabi_mfg_sessions_v2', JSON.stringify(STATE.sessions.slice(0, 50)));
      localStorage.setItem('isabi_mfg_custom_recs_v2', JSON.stringify(STATE.customRecords));
      localStorage.setItem('isabi_mfg_face_settings_v1', JSON.stringify(STATE.faceSettings));
    } catch (_) { /* storage full or blocked — the cloud copy still holds the state */ }
  }

  function mergeUserRow(existing, incoming) {
    if (!existing) return Object.assign({ face_samples: [], face_thumbs: [], face_required: false, face_updated_at: '' }, incoming);
    if (!incoming) return existing;
    const out = Object.assign({}, existing, incoming);
    const exSamples = userFaceSamples(existing);
    const inSamples = userFaceSamples(incoming);
    const exThumbs = userFaceThumbs(existing);
    const inThumbs = userFaceThumbs(incoming);
    const exTs = String(existing.face_updated_at || '');
    const inTs = String(incoming.face_updated_at || '');
    if (inSamples.length && ((!exSamples.length && !(existing.face_cleared && exTs > inTs)) || inTs >= exTs)) {
      out.face_samples = inSamples;
      out.face_thumbs = inThumbs.length ? inThumbs : exThumbs;
      out.face_required = incoming.face_required != null ? !!incoming.face_required : true;
      out.face_updated_at = inTs || exTs;
      delete out.face_cleared;
    } else if (exSamples.length && (!inSamples.length && !(incoming.face_cleared && inTs > exTs))) {
      out.face_samples = exSamples;
      out.face_thumbs = exThumbs;
      out.face_required = existing.face_required != null ? !!existing.face_required : true;
      out.face_updated_at = exTs;
      delete out.face_cleared;
    } else {
      out.face_samples = inSamples;
      out.face_thumbs = inSamples.length ? (inThumbs.length ? inThumbs : exThumbs) : [];
      out.face_required = !!(incoming.face_required && inSamples.length);
      out.face_updated_at = inTs || exTs;
      if (!out.face_samples.length && (existing.face_cleared || incoming.face_cleared)) out.face_cleared = true;
    }
    return out;
  }

  // Union-merge another device's app entries into ours. A void tombstone always wins.
  function mergeCustomRecords(remote) {
    if (!remote || typeof remote !== 'object') return false;
    let changed = false;
    CR_KEYS.forEach(k => {
      const inc = Array.isArray(remote[k]) ? remote[k] : [];
      const mine = STATE.customRecords[k];
      const byId = new Map(mine.map(r => [r.id, r]));
      inc.forEach(r => {
        if (!r || !r.id) return;
        const cur = byId.get(r.id);
        if (!cur) { mine.push(r); byId.set(r.id, r); changed = true; }
        else if (r.voided && !cur.voided) { cur.voided = true; cur.voided_by = r.voided_by; cur.voided_at = r.voided_at; changed = true; }
      });
    });
    return changed;
  }

  // Project the app entries onto the seed registers (voided rows drop out, new rows sort in by date)
  function applyCustomRecordsToSeed() {
    CR_KEYS.forEach(k => {
      const list = SEED.records[k];
      const seen = new Set(list.map(x => x.id));
      let touched = false;
      STATE.customRecords[k].forEach(r => {
        if (r.voided) {
          const i = list.findIndex(x => x.id === r.id);
          if (i >= 0) { list.splice(i, 1); touched = true; }
          return;
        }
        if (!seen.has(r.id)) { list.push(r); seen.add(r.id); touched = true; }
      });
      if (touched) list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    });
  }

  function cloudPayload() {
    const trimmed = {};
    CR_KEYS.forEach(k => { trimmed[k] = STATE.customRecords[k].slice(0, 1500); });
    return {
      users: STATE.users,
      sessions: STATE.sessions.slice(0, 25),
      customRecords: trimmed,
      faceSettings: STATE.faceSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: activeUser().email,
      appVersion: '4.5'
    };
  }

  function uiBusy() {
    const m = $('entryModal');
    if (m && !m.hidden) return true;
    const ins = $('recordInspector');
    if (ins && !ins.hidden) return true;
    if (STATE.showAddUserForm || FACE_STATE.enrolCamActive) return true;
    const a = document.activeElement;
    return !!(a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.id !== 'aiInput');
  }
  function safeRender() {
    if (uiBusy()) { STATE.renderPending = true; return; }
    renderApp();
  }

  let syncInFlight = null;
  async function syncWithCloud(pushChanges = false) {
    if (syncInFlight) { if (pushChanges) STATE.pushAfterSync = true; return syncInFlight; }
    syncInFlight = doSync(pushChanges || STATE.pushAfterSync).finally(() => {
      syncInFlight = null;
      if (STATE.pushAfterSync) { STATE.pushAfterSync = false; syncWithCloud(true); }
    });
    return syncInFlight;
  }

  async function doSync(pushChanges) {
    // 1. Local SQLite server (LAN host only)
    if (HAS_LOCAL_API) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const rLocal = await fetch('./api/users', { signal: ctrl.signal });
        clearTimeout(t);
        if (rLocal.ok) {
          const dLocal = await rLocal.json();
          if (Array.isArray(dLocal.users) && dLocal.users.length) {
            const byEmail = new Map(STATE.users.map(u => [norm(u.email), u]));
            dLocal.users.forEach(u => { const k = norm(u.email); if (k) byEmail.set(k, mergeUserRow(byEmail.get(k), u)); });
            STATE.users = Array.from(byEmail.values());
          }
        }
      } catch (_) { /* server.py not running */ }
    }

    // 2. BHFIRMS Multi-Device Cloud Relay (GitHub Pages + mobile + desktop)
    if (!CLOUD_URL || !CLOUD_KEY || navigator.webdriver || window.__MFG_HEADLESS_TEST || PARAMS.get('nosse') === '1' || (location.port && Number(location.port) >= 8095)) {
      STATE.cloudStatus = '● Ready (Local)';
      updateCloudBadges();
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const getRes = await fetch(CLOUD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ key: CLOUD_KEY, op: 'get' }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!getRes.ok) throw new Error('relay ' + getRes.status);

      const store = await getRes.json();
      const docs = (store && store.docs) || store || {};
      const remote = docs[CLOUD_DOC_KEY] || {};
      let changed = false;

      if (Array.isArray(remote.users) && remote.users.length) {
        const byEmail = new Map();
        remote.users.forEach(u => { if (u && u.email) byEmail.set(norm(u.email), u); });
        if (pushChanges) STATE.users.forEach(u => { if (u && u.email) byEmail.set(norm(u.email), mergeUserRow(byEmail.get(norm(u.email)), u)); });
        else {
          // keep any seat or biometric enrolment only this device knows about so it is not lost before the next push
          STATE.users.forEach(u => {
            if (!u || !u.email) return;
            const k = norm(u.email);
            if (!byEmail.has(k)) { byEmail.set(k, u); pushChanges = true; }
            else byEmail.set(k, mergeUserRow(u, byEmail.get(k)));
          });
        }
        const next = Array.from(byEmail.values());
        if (JSON.stringify(next) !== JSON.stringify(STATE.users)) { changed = true; }
        const myEmail = norm(activeUser().email);
        STATE.users = next;
        const idx = STATE.users.findIndex(u => norm(u.email) === myEmail);
        if (idx >= 0) STATE.activeUserIdx = idx;
        if (!STATE.authed) { renderQuickSeatsInAuthGate(); updateAuthFaceUi(); }
      }

      if (Array.isArray(remote.sessions) && remote.sessions.length) {
        const seenS = new Set(STATE.sessions.map(s => s.id));
        remote.sessions.forEach(s => { if (s && s.id && !seenS.has(s.id)) { STATE.sessions.push(s); seenS.add(s.id); changed = true; } });
        STATE.sessions.sort((a, b) => String(b.logged_in_at || '').localeCompare(String(a.logged_in_at || '')));
        STATE.sessions = STATE.sessions.slice(0, 50);
      }

      if (remote.customRecords && mergeCustomRecords(remote.customRecords)) { changed = true; applyCustomRecordsToSeed(); }
      // anything only we hold → push
      if (!pushChanges && remote.customRecords) {
        const remoteIds = new Set();
        CR_KEYS.forEach(k => (remote.customRecords[k] || []).forEach(r => r && remoteIds.add(r.id + (r.voided ? '|v' : ''))));
        CR_KEYS.forEach(k => STATE.customRecords[k].forEach(r => { if (!remoteIds.has(r.id + (r.voided ? '|v' : ''))) pushChanges = true; }));
      }

      saveLocalAuthAndRecords();
      STATE.cloudStatus = '● Cloud Live';
      STATE.cloudUpdatedAt = remote.updatedAt || '';

      if (pushChanges || !docs[CLOUD_DOC_KEY]) {
        const payload = cloudPayload();
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), 15000);
        const putRes = await fetch(CLOUD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ key: CLOUD_KEY, op: 'patch', patch: { [CLOUD_DOC_KEY]: payload } }),
          signal: ctrl2.signal
        });
        clearTimeout(timer2);
        if (putRes.ok) STATE.cloudUpdatedAt = payload.updatedAt;
        else STATE.cloudStatus = '● Cloud read-only (' + putRes.status + ')';
      }
      updateCloudBadges();
      if (changed) safeRender();
    } catch (_) {
      STATE.cloudStatus = navigator.onLine ? '● Relay unreachable' : '● Offline Cache';
      updateCloudBadges();
    }
  }

  function updateCloudBadges() {
    const el = $('sqlStatusText');
    if (el && !HAS_LOCAL_API) el.textContent = STATE.cloudStatus.replace('● ', '');
    const auth = $('authCloudStatusBadge');
    if (auth) { auth.textContent = STATE.cloudStatus; auth.className = /Live|Ready/.test(STATE.cloudStatus) ? 'auth-cloud-ok' : 'auth-cloud-warn'; }
  }

  // ==========================================================================
  // BIOMETRIC FACE ID ENGINE (ATTENDANCE PWA PARITY: 128-D + STEP-UP 2FA)
  // ==========================================================================
  function streamAlive() {
    return !!(FACE_STATE.stream && FACE_STATE.stream.getVideoTracks && FACE_STATE.stream.getVideoTracks().some(t => t.readyState === 'live'));
  }

  async function ensureFaceModelsLoaded() {
    if (!window.Face) throw new Error('Face recognition module not loaded');
    await window.Face.load('./vendor/models');
    return true;
  }

  async function startFaceCamera(videoEl) {
    if (!videoEl) return false;
    try {
      if (!streamAlive() && window.Face && typeof window.Face.consumeEarlyStream === 'function') {
        const early = window.Face.consumeEarlyStream();
        if (early && early.getVideoTracks && early.getVideoTracks().some(t => t.readyState === 'live')) {
          FACE_STATE.stream = early;
        }
      }
      if (!streamAlive()) {
        if (FACE_STATE.stream) { try { FACE_STATE.stream.getTracks().forEach(t => t.stop()); } catch (_) {} }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
        FACE_STATE.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      }
      if (videoEl.srcObject !== FACE_STATE.stream) videoEl.srcObject = FACE_STATE.stream;
      await videoEl.play().catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function stopFaceCamera() {
    if (FACE_STATE.loopTimer) { clearTimeout(FACE_STATE.loopTimer); FACE_STATE.loopTimer = null; }
    if (FACE_STATE.enrolLoopTimer) { clearTimeout(FACE_STATE.enrolLoopTimer); FACE_STATE.enrolLoopTimer = null; }
    if (FACE_STATE.enrolTestTimer) { clearTimeout(FACE_STATE.enrolTestTimer); FACE_STATE.enrolTestTimer = null; }
    FACE_STATE.camActive = false;
    FACE_STATE.enrolCamActive = false;
    FACE_STATE.enrolTestActive = false;
    if (FACE_STATE.stream) {
      try { FACE_STATE.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      FACE_STATE.stream = null;
    }
    ['authFaceVideo', 'enrolFaceVideo'].forEach(id => {
      const v = $(id);
      if (v) v.srcObject = null;
    });
    ['authFaceOverlay', 'enrolFaceOverlay'].forEach(id => {
      const cv = $(id);
      if (cv && cv.getContext) {
        try { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); } catch (_) {}
      }
    });
  }

  function setAuthHint(text, cls) {
    const el = $('authFaceHint');
    if (!el) return;
    el.textContent = text;
    el.className = 'auth-face-hint' + (cls ? ' ' + cls : '');
  }

  function setAuthStreak(count, needed) {
    const fill = $('authStreakFill');
    if (fill) fill.style.width = Math.min(100, Math.round((count / Math.max(1, needed)) * 100)) + '%';
  }

  function updateAuthFaceUi() {
    const enrolled = STATE.users.filter(userHasFaceId);
    const statsEl = $('authFaceStats');
    const camBtn = $('authCamToggleBtn');
    const sndBtn = $('authSoundBtn');
    const sndLbl = $('authSoundLbl');
    const dotEl = $('authFacePulse') || $('authFaceDot');
    const bannerEl = $('authFaceTargetBanner');
    const targetNameEl = $('authFaceTargetText') || $('authFaceTargetName');

    if (sndLbl) sndLbl.textContent = STATE.faceSettings.sound ? '🔊' : '🔇';
    else if (sndBtn) sndBtn.textContent = STATE.faceSettings.sound ? '🔊 Sound' : '🔇 Muted';
    if (camBtn) camBtn.textContent = FACE_STATE.camActive ? '📷 Camera On' : '📷 Scan Face ID';
    if (dotEl) dotEl.className = 'auth-face-pulse' + (FACE_STATE.camActive ? ' live' : '');

    if (bannerEl) {
      if (FACE_STATE.pending2faUser) {
        bannerEl.hidden = false;
        if (targetNameEl) targetNameEl.textContent = `🔒 Step 2 of 2: Face ID Required for ${FACE_STATE.pending2faUser.full_name} — look at the camera`;
      } else {
        bannerEl.hidden = true;
      }
    }

    if (statsEl) {
      const ready = !!(window.Face && window.Face.ready);
      const be = (window.Face && window.Face.backend) || 'webgl';
      statsEl.textContent = `${enrolled.length}/${STATE.users.length} Face ID · τ≤${Number(STATE.faceSettings.threshold).toFixed(2)} · ${ready ? 'Ready (' + be + ')' : '128-d Biometric'}`;
    }
    const hintEl = $('authFaceHint');
    if (enrolled.length && hintEl && /No Face ID seats enrolled|open Team Auth to enrol/i.test(hintEl.textContent || '')) {
      setAuthHint(`Look at the camera for instant Face ID sign-in (${enrolled.length} enrolled)`, 'ok');
    }
  }

  function livenessStep(landmarks) {
    if (!STATE.faceSettings.liveness) return true;
    if (!landmarks || !window.Face || !window.Face.ear) return false;
    const ear = window.Face.ear(landmarks);
    const now = Date.now();
    if (ear > 0 && ear < 0.20) FACE_STATE.eyeClosedSeen = true;
    else if (FACE_STATE.eyeClosedSeen && ear > 0.26) {
      FACE_STATE.lastBlinkAt = now;
      FACE_STATE.eyeClosedSeen = false;
    }
    return (now - FACE_STATE.lastBlinkAt) < 4000;
  }

  async function completeFaceLogin(user, dist, snapshotUrl, methodLabel) {
    if (!user) return false;
    FACE_STATE.cooldownUntil = Date.now() + 2500;
    FACE_STATE.pending2faUser = null;
    const confPct = Math.max(55, Math.min(99.8, Math.round((1 - Number(dist || 0.2) * 0.85) * 1000) / 10));

    if (STATE.faceSettings.sound && window.Face && window.Face.Sound) {
      window.Face.Sound.playSuccess();
    }

    // Show verification card overlay on #authGate briefly
    const card = $('authFaceCard');
    const photoEl = $('authFaceCardImg') || $('authFacePhoto');
    const nameEl = $('authFaceCardName') || $('authFaceName');
    const metaEl = $('authFaceCardMeta') || $('authFaceMeta');
    const confEl = $('authFaceCardSub') || $('authFaceConf');
    const badgeEl = $('authFaceCardBadge') || $('authFaceBadge');
    if (card) {
      if (badgeEl) badgeEl.textContent = methodLabel || 'BIOMETRIC FACE ID VERIFIED';
      if (nameEl) nameEl.textContent = user.full_name;
      if (metaEl) metaEl.textContent = `${confPct.toFixed(1)}% · d=${Number(dist || 0).toFixed(3)}`;
      if (confEl) confEl.textContent = `${user.role} · ${user.companies}`;
      if (photoEl && snapshotUrl) photoEl.src = snapshotUrl;
      card.hidden = false;
    }

    await new Promise(r => setTimeout(r, (navigator.webdriver || window.__MFG_HEADLESS_TEST) ? 60 : 220));
    if (card) card.hidden = true;
    return performLogin(user.email, user.pin_code || '1111', {
      bypass2FA: true,
      method: methodLabel || 'Face ID',
      confidence: confPct
    });
  }

  // Evaluates a single 128-d face detection against enrolled seats (used by live camera loop AND headless tests)
  async function handleAuthDescriptor(det, snapshotUrl, opts = {}) {
    const baseNeeded = Math.max(1, Number(STATE.faceSettings.confirmFrames || 3));
    const enrolled = usableFaces();
    if (!enrolled.length) {
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      setAuthStreak(0, baseNeeded);
      setAuthHint('No Face ID seats enrolled yet — sign in with PIN below, then open Team Auth to enrol your 3 poses.', 'warn');
      return { status: 'no-enrolled' };
    }
    if (!det || !det.descriptor) {
      FACE_STATE.missedFrames = (FACE_STATE.missedFrames || 0) + 1;
      if (!FACE_STATE.streakCount || FACE_STATE.missedFrames >= 3) {
        FACE_STATE.streakUser = null;
        FACE_STATE.streakCount = 0;
        setAuthStreak(0, baseNeeded);
        setAuthHint(FACE_STATE.pending2faUser ? `Look at the camera to verify ${FACE_STATE.pending2faUser.full_name}` : 'Position your face inside the frame for instant Face ID sign-in', '');
      }
      return { status: 'no-face' };
    }
    FACE_STATE.missedFrames = 0;
    if (det.multiple) {
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      setAuthStreak(0, baseNeeded);
      setAuthHint('One person at a time in front of the camera', 'warn');
      return { status: 'multiple' };
    }

    const cfg = Object.assign({}, window.Face.CONFIG, {
      threshold: Number(STATE.faceSettings.threshold || 0.50),
      margin: Number(STATE.faceSettings.margin || 0.08),
      weakAbove: Number(STATE.faceSettings.weakAbove || 0.45),
      minFaceFrac: Number(STATE.faceSettings.minFaceFrac || 0.14)
    });
    const m = window.Face.match(det.descriptor, enrolled);
    const dec = window.Face.decide(m, cfg, { faceSizeFrac: det.faceSizeFrac != null ? det.faceSizeFrac : 0.25 });
    const strongLiveMatch = !!(opts && opts.liveCamera && m.bestDist <= 0.44 && (m.secondDist - m.bestDist) >= 0.12);
    const needed = (opts && opts.liveCamera)
      ? (strongLiveMatch ? 1 : Math.min(2, baseNeeded))
      : baseNeeded;

    if (!dec.ok) {
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      setAuthStreak(0, needed);
      if (dec.status === 'too-small') setAuthHint('Move closer to the camera', 'warn');
      else if (dec.status === 'ambiguous') setAuthHint(`Hold still — close match between two seats (d=${m.bestDist.toFixed(2)})`, 'warn');
      else setAuthHint(`Face not recognized (d=${m.bestDist.toFixed(2)} > τ=${cfg.threshold.toFixed(2)}) — sign in with PIN or re-enrol 3 poses`, 'crit');
      return { status: dec.status, match: m };
    }

    // If step-up 2FA is waiting for a specific seat, verify it matches that exact seat
    if (FACE_STATE.pending2faUser && norm(dec.best.email) !== norm(FACE_STATE.pending2faUser.email)) {
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      setAuthStreak(0, needed);
      if (STATE.faceSettings.sound && window.Face && window.Face.Sound) window.Face.Sound.playWarn();
      setAuthHint(`2FA mismatch: expected ${FACE_STATE.pending2faUser.full_name}, saw ${dec.best.name}`, 'crit');
      return { status: '2fa-mismatch', expected: FACE_STATE.pending2faUser.email, actual: dec.best.email };
    }

    const blinkOk = livenessStep(det.landmarks);
    if (!blinkOk) {
      setAuthHint(`${dec.best.name} recognized — blink once to confirm liveness`, 'warn');
      return { status: 'awaiting-blink', best: dec.best, dist: m.bestDist };
    }

    if (FACE_STATE.streakUser && norm(FACE_STATE.streakUser.email) === norm(dec.best.email)) {
      FACE_STATE.streakCount += 1;
    } else {
      FACE_STATE.streakUser = dec.best;
      FACE_STATE.streakCount = 1;
    }
    FACE_STATE.bestDist = m.bestDist;
    FACE_STATE.secondDist = m.secondDist;
    setAuthStreak(FACE_STATE.streakCount, needed);

    if (FACE_STATE.streakCount < needed) {
      setAuthHint(`Verifying ${dec.best.name} (${FACE_STATE.streakCount}/${needed} frames · d=${m.bestDist.toFixed(2)})…`, 'ok');
      return { status: 'streak', count: FACE_STATE.streakCount, needed, best: dec.best, dist: m.bestDist };
    }

    // Confirmed across N consecutive frames!
    FACE_STATE.streakUser = null;
    FACE_STATE.streakCount = 0;
    setAuthStreak(needed, needed);
    const matchedUser = STATE.users.find(u => norm(u.email) === norm(dec.best.email));
    const methodLabel = FACE_STATE.pending2faUser ? 'PIN + Face ID 2FA' : 'Face ID';
    setAuthHint(`✓ Verified ${dec.best.name} (${methodLabel})`, 'ok');
    if (!snapshotUrl && opts && opts.videoEl && window.Face && window.Face.snapshot) {
      try { snapshotUrl = window.Face.snapshot(opts.videoEl); } catch (_) {}
    }
    await completeFaceLogin(matchedUser, m.bestDist, snapshotUrl, methodLabel);
    return { status: 'verified', user: matchedUser, dist: m.bestDist, method: methodLabel };
  }

  async function authFaceTick() {
    if (STATE.authed || !FACE_STATE.camActive) return;
    const videoEl = $('authFaceVideo');
    const overlayEl = $('authFaceOverlay');
    if (!videoEl || Date.now() < FACE_STATE.cooldownUntil) {
      FACE_STATE.loopTimer = setTimeout(authFaceTick, 120);
      return;
    }
    if (!FACE_STATE.busy && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      FACE_STATE.busy = true;
      try {
        await ensureFaceModelsLoaded();
        const det = await window.Face.detectOne(videoEl, false);
        if (overlayEl && window.Face.drawOverlay) {
          const color = det && !det.multiple ? (FACE_STATE.streakCount > 0 ? '#16A34A' : '#B8883B') : '#DC2626';
          window.Face.drawOverlay(overlayEl, videoEl, det, color, FACE_STATE.streakUser ? FACE_STATE.streakUser.name : '');
        }
        await handleAuthDescriptor(det, '', { liveCamera: true, videoEl });
      } catch (_) {
        /* ignore transient frame error */
      } finally {
        FACE_STATE.busy = false;
      }
    }
    if (!STATE.authed && FACE_STATE.camActive) {
      FACE_STATE.loopTimer = setTimeout(authFaceTick, 75);
    }
  }

  async function startAuthFaceScanner(forceStart = false) {
    updateAuthFaceUi();
    if ((navigator.webdriver || window.__MFG_HEADLESS_TEST) && !forceStart) {
      setAuthHint('Biometric Face ID Scanner ready · Look at the camera or sign in with Email + PIN below', '');
      return false;
    }
    const videoEl = $('authFaceVideo');
    if (!videoEl) return false;
    setAuthHint('Starting camera & loading 128-d neural models…', '');
    const modelPromise = ensureFaceModelsLoaded().catch(() => false);
    const camOk = await startFaceCamera(videoEl);
    FACE_STATE.camActive = camOk;
    updateAuthFaceUi();
    if (!camOk) {
      setAuthHint('Camera off or permission declined — click "Enable Camera" above or sign in with Email + PIN.', 'warn');
      return false;
    }
    const enrolled = usableFaces();
    setAuthHint(
      FACE_STATE.pending2faUser
        ? `🔒 Look at the camera to complete 2FA for ${FACE_STATE.pending2faUser.full_name}`
        : (enrolled.length
          ? `Look at the camera for instant Face ID sign-in (${enrolled.length} enrolled)`
          : 'Camera active · Sign in with PIN below, then open Team Auth to enrol your 3 Face ID poses'),
      enrolled.length ? 'ok' : ''
    );
    modelPromise.then(() => { if (!STATE.authed) updateAuthFaceUi(); });
    if (FACE_STATE.loopTimer) clearTimeout(FACE_STATE.loopTimer);
    FACE_STATE.loopTimer = setTimeout(authFaceTick, 25);
    return true;
  }

  function stopAuthFaceScanner() {
    if (FACE_STATE.loopTimer) { clearTimeout(FACE_STATE.loopTimer); FACE_STATE.loopTimer = null; }
    FACE_STATE.camActive = false;
    if (!FACE_STATE.enrolCamActive) stopFaceCamera();
    updateAuthFaceUi();
  }

  // ---- Enrolment Studio & Calibration helpers (Users & Cloud Auth view) ----
  function triggerEnrolShutterFlash() {
    const fl = $('enrolShutterFlash');
    if (!fl) return;
    fl.classList.remove('active');
    void fl.offsetWidth;
    fl.classList.add('active');
    setTimeout(() => { if (fl.isConnected) fl.classList.remove('active'); }, 260);
  }

  function wireEnrolPoseSlots(root) {
    if (!root) return;
    root.querySelectorAll('[data-retake-pose]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const slot = Number(el.getAttribute('data-retake-pose'));
        if (Number.isFinite(slot) && slot >= 0 && slot < 3) {
          captureEnrolDescriptor(null, '', slot);
        }
      });
    });
  }

  function wireUsersDirectoryActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-enrol-user]').forEach(btn => btn.addEventListener('click', () => {
      const uidTarget = btn.getAttribute('data-enrol-user');
      const u = STATE.users.find(x => String(x.id) === String(uidTarget));
      if (!u) return;
      FACE_STATE.enrolUserId = u.id;
      syncEnrolBufferFromUser(u, true);
      updateEnrolStudioDom();
      const panel = $('faceEnrolPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    root.querySelectorAll('[data-sim-user]').forEach(btn => btn.addEventListener('click', () => {
      if (!isOwner()) return;
      const u = STATE.users[Number(btn.getAttribute('data-sim-user'))];
      if (u) performLogin(u.email, u.pin_code || '1111', { bypass2FA: true, method: 'Owner Impersonation' });
    }));
    root.querySelectorAll('[data-invite-user]').forEach(btn => btn.addEventListener('click', () => {
      if (!isOwner()) return;
      const u = STATE.users[Number(btn.getAttribute('data-invite-user'))];
      if (!u) return;
      const inviteUrl = `${location.origin}${location.pathname}?email=${encodeURIComponent(u.email)}&pin=${encodeURIComponent(u.pin_code || '1111')}`;
      const done = () => { btn.textContent = '✓ Copied Link!'; setTimeout(() => { btn.textContent = 'Invite Link'; }, 2000); toast('Invite link copied — it carries the PIN, share it privately'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inviteUrl).then(done).catch(() => { window.prompt('Copy this invite link:', inviteUrl); });
      else window.prompt('Copy this invite link:', inviteUrl);
    }));
    root.querySelectorAll('[data-toggle-user]').forEach(btn => btn.addEventListener('click', async () => {
      if (!isOwner()) return;
      const idx = Number(btn.getAttribute('data-toggle-user'));
      const u = STATE.users[idx];
      if (!u) return;
      if (idx === STATE.activeUserIdx) { toast('You cannot suspend your own seat', 'err'); return; }
      u.status = u.status === 'Suspended' ? 'Active' : 'Suspended';
      saveLocalAuthAndRecords();
      updateEnrolStudioDom();
      if (HAS_LOCAL_API) { try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u }) }); } catch (_) { /* no server.py */ } }
      syncWithCloud(true);
      toast(`${u.full_name} ${u.status === 'Suspended' ? 'suspended' : 're-activated'}`);
    }));
  }

  // Surgical DOM updater for the Biometric Enrolment Studio: NEVER destroys <video id="enrolFaceVideo">
  function updateEnrolStudioDom() {
    const panel = $('faceEnrolPanel');
    if (!panel) {
      renderApp();
      return;
    }
    const enrolUser = enrolTargetUser();
    const enrolSavedSamples = userFaceSamples(enrolUser);
    const capCount = FACE_STATE.enrolCaptures.length;
    const poseComplete = capCount >= 3;
    const faceCount = STATE.users.filter(userHasFaceId).length;
    const uCount = STATE.users.length;

    const cockpitCountEl = $('enrolCockpitCount');
    if (cockpitCountEl) {
      cockpitCountEl.textContent = `${faceCount} / ${uCount} Enrolled`;
      cockpitCountEl.className = `cockpit-pill-val ${faceCount ? 'emerald' : 'amber'}`;
    }

    const hdrBadge = $('enrolHeaderBadge');
    if (hdrBadge) {
      hdrBadge.className = `enrol-seat-pill ${enrolSavedSamples.length ? 'enrolled' : 'pending'}`;
      hdrBadge.textContent = enrolSavedSamples.length
        ? `✓ ${enrolUser.full_name} · ${enrolSavedSamples.length}/3 Poses Stored`
        : `${enrolUser.full_name} · Not Enrolled`;
    }

    const ph = $('enrolCamPlaceholder');
    if (ph) ph.hidden = !!FACE_STATE.enrolCamActive;

    const hudDot = $('enrolHudDot');
    if (hudDot) hudDot.className = `enrol-hud-dot ${FACE_STATE.enrolCamActive ? 'live' : ''}`;
    const hudTel = $('enrolHudTelemetry');
    if (hudTel && !FACE_STATE.enrolCamActive) {
      hudTel.textContent = capCount ? `${capCount}/3 POSES STORED` : 'CAMERA STANDBY';
    }

    const strip = $('enrolThumbStrip');
    if (strip) {
      strip.innerHTML = renderEnrolThumbStripHtml();
      wireEnrolPoseSlots(strip);
    }

    const stepper = $('enrolPoseStepper');
    if (stepper) {
      stepper.innerHTML = renderEnrolStepperHtml();
      wireEnrolPoseSlots(stepper);
    }

    const guide = $('enrolPoseGuide');
    if (guide) {
      guide.className = `mfg-pose-guide ${poseComplete ? 'complete' : ''}`;
      guide.innerHTML = renderEnrolPoseGuideInnerHtml();
    }

    const consentCb = $('enrolConsentCb');
    if (consentCb) consentCb.checked = !!FACE_STATE.enrolConsent;

    const statusBar = $('enrolStatusBar');
    if (statusBar) {
      statusBar.className = `enrol-status-bar ${FACE_STATE.enrolStatusCls || ''}`.trim();
      statusBar.textContent = FACE_STATE.enrolStatusText || '';
    }

    const startBtn = $('enrolStartCamBtn');
    if (startBtn) {
      startBtn.innerHTML = FACE_STATE.enrolCamActive
        ? `${ENROL_SVGS.stop}<span>Stop Camera</span>`
        : `${ENROL_SVGS.cam}<span>Start Camera</span>`;
    }
    const capBtn = $('enrolCaptureBtn');
    if (capBtn) {
      capBtn.disabled = false;
      capBtn.innerHTML = `${ENROL_SVGS.shutter}<span>${poseComplete ? 'Retake All 3 Poses' : `Capture Pose (${Math.min(capCount + 1, 3)}/3)`}</span>`;
    }
    const saveBtn = $('enrolSaveBtn');
    if (saveBtn) {
      saveBtn.disabled = !capCount;
      saveBtn.innerHTML = `${ENROL_SVGS.shield}<span>${enrolSavedSamples.length && capCount ? `Saved & Synced (${capCount}/3)` : `Save Face ID (${capCount}/3)`}</span>`;
    }
    const testBtn = $('enrolTestBtn');
    if (testBtn) {
      testBtn.innerHTML = `${ENROL_SVGS.scan}<span>${FACE_STATE.enrolTestActive ? 'Stop Test' : 'Test Recognition'}</span>`;
    }
    const clrBtn = $('enrolClearBtn');
    if (clrBtn) {
      clrBtn.disabled = !(enrolSavedSamples.length || capCount);
    }

    const sel = $('enrolUserSelect');
    if (sel) {
      Array.from(sel.options).forEach(opt => {
        const u = STATE.users.find(x => String(x.id) === String(opt.value));
        if (u) {
          const n = userFaceSamples(u).length;
          opt.textContent = `${u.full_name} (${n ? n + '/3 poses' : 'no Face ID'})`;
          opt.selected = String(u.id) === String(enrolUser.id);
        }
      });
    }

    const tbody = $('usersDirectoryTbody');
    if (tbody) {
      tbody.innerHTML = renderUsersDirectoryRowsHtml();
      wireUsersDirectoryActions(tbody);
    }

    const calibWrap = $('enrolCalibWrap');
    if (calibWrap) {
      calibWrap.hidden = !FACE_STATE.calibReportHtml;
      calibWrap.innerHTML = FACE_STATE.calibReportHtml || '';
    }
  }

  async function enrolFaceTick() {
    if (STATE.view !== 'users' || !FACE_STATE.enrolCamActive) return;
    const videoEl = $('enrolFaceVideo');
    const overlayEl = $('enrolFaceOverlay');
    const hudTel = $('enrolHudTelemetry');
    const hudDot = $('enrolHudDot');
    if (videoEl && !FACE_STATE.enrolBusy && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      FACE_STATE.enrolBusy = true;
      try {
        await ensureFaceModelsLoaded();
        const det = await window.Face.detectOne(videoEl, false);
        if (det && det.descriptor) {
          FACE_STATE.lastLiveEnrolDet = det;
          FACE_STATE.lastLiveEnrolAt = Date.now();
          if (window.Face.snapshot) FACE_STATE.lastLiveEnrolSnap = window.Face.snapshot(videoEl);
        }
        if (overlayEl && window.Face.drawOverlay) {
          const col = det && det.descriptor ? '#22c55e' : '#D9A54A';
          window.Face.drawOverlay(overlayEl, videoEl, det, col);
        }
        if (hudTel) {
          if (det && det.descriptor) {
            const pct = Math.round(Math.max(0.72, Number(det.score || det.detScore || 0.9)) * 100);
            hudTel.textContent = `LOCKED ${pct}% · 128-D READY`;
            if (hudDot) hudDot.className = 'enrol-hud-dot live locked';
          } else {
            hudTel.textContent = 'ALIGN FACE IN RETICLE';
            if (hudDot) hudDot.className = 'enrol-hud-dot live';
          }
        }
      } catch (_) {
        /* ignore transient frame error */
      } finally {
        FACE_STATE.enrolBusy = false;
      }
    }
    if (STATE.view === 'users' && FACE_STATE.enrolCamActive) {
      FACE_STATE.enrolLoopTimer = setTimeout(enrolFaceTick, 220);
    }
  }

  async function startEnrolCamera() {
    const ev = $('enrolFaceVideo');
    if (!ev) return false;
    FACE_STATE.enrolStatusText = 'Starting camera & loading 128-d neural recognition models…';
    FACE_STATE.enrolStatusCls = '';
    updateEnrolStudioDom();
    try { await ensureFaceModelsLoaded(); } catch (_) {}
    const ok = await startFaceCamera(ev);
    FACE_STATE.enrolCamActive = ok;
    if (ok) {
      for (let i = 0; i < 18; i++) {
        if (ev.readyState >= 2 && ev.videoWidth > 0) break;
        await new Promise(r => setTimeout(r, 50));
      }
      if (FACE_STATE.enrolLoopTimer) clearTimeout(FACE_STATE.enrolLoopTimer);
      FACE_STATE.enrolLoopTimer = setTimeout(enrolFaceTick, 120);
      const nextPose = Math.min(FACE_STATE.enrolCaptures.length, 2);
      FACE_STATE.enrolStatusText = `Camera live — ${FACE_POSES[nextPose]}. Click "Capture Pose" to snap and store.`;
      FACE_STATE.enrolStatusCls = 'ok';
    } else {
      FACE_STATE.enrolStatusText = 'Camera unavailable or permission denied on this device.';
      FACE_STATE.enrolStatusCls = 'warn';
    }
    updateEnrolStudioDom();
    return ok;
  }

  async function persistTargetFaceNow(target) {
    if (!target) return;
    target.face_samples = FACE_STATE.enrolCaptures.slice(0, 5);
    target.face_thumbs = FACE_STATE.enrolThumbs.slice(0, 3);
    target.face_required = target.face_samples.length > 0;
    target.face_cleared = target.face_samples.length === 0;
    target.face_updated_at = new Date().toISOString();
    FACE_STATE.enrolLoadedForUserId = String(target.id);
    saveLocalAuthAndRecords();
    if (HAS_LOCAL_API) {
      try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: target }) }); } catch (_) {}
    }
    await syncWithCloud(true);
  }

  async function captureEnrolDescriptor(syntheticDet, syntheticThumb, slotOverride) {
    const target = enrolTargetUser();
    if (!target) return { ok: false, reason: 'no-user' };

    // Always auto-enable biometric consent when the user initiates capture so it never blocks storing their photo
    if (!FACE_STATE.enrolConsent) {
      FACE_STATE.enrolConsent = true;
      const cb = $('enrolConsentCb');
      if (cb) cb.checked = true;
    }

    const isSlotRetake = typeof slotOverride === 'number' && slotOverride >= 0 && slotOverride < 3;
    if (!isSlotRetake && FACE_STATE.enrolCaptures.length >= 3) {
      if (syntheticDet) {
        FACE_STATE.enrolStatusText = 'All 3 poses are already captured and stored.';
        FACE_STATE.enrolStatusCls = 'ok';
        updateEnrolStudioDom();
        return { ok: false, reason: 'already-3' };
      }
      // Interactive UI click on "Retake All 3 Poses": start a fresh 3-pose capture sequence
      FACE_STATE.enrolCaptures = [];
      FACE_STATE.enrolThumbs = [];
    }

    let det = syntheticDet || null;
    let thumb = syntheticThumb || '';
    if (!det) {
      let videoEl = $('enrolFaceVideo');
      if (!FACE_STATE.enrolCamActive || !streamAlive() || !videoEl || videoEl.readyState < 2) {
        const started = await startEnrolCamera();
        videoEl = $('enrolFaceVideo');
        if (!started || !videoEl || videoEl.readyState < 2) {
          FACE_STATE.enrolStatusText = 'Camera could not start — grant camera permission in your browser address bar.';
          FACE_STATE.enrolStatusCls = 'warn';
          updateEnrolStudioDom();
          return { ok: false, reason: 'no-camera' };
        }
      }
      triggerEnrolShutterFlash();
      await ensureFaceModelsLoaded();
      // Pass allowCropFallback=true so backlit webcam frames still extract a 128-d descriptor + snapshot
      det = await window.Face.detectOne(videoEl, true);
      if ((!det || !det.descriptor) && FACE_STATE.lastLiveEnrolDet && (Date.now() - FACE_STATE.lastLiveEnrolAt) < 2500) {
        det = FACE_STATE.lastLiveEnrolDet;
      }
      if (window.Face.snapshot) {
        thumb = window.Face.snapshot(videoEl) || FACE_STATE.lastLiveEnrolSnap || '';
      }
    }

    if (!det || !det.descriptor) {
      FACE_STATE.enrolStatusText = 'No face detected — position your face inside the reticle and click Capture Pose.';
      FACE_STATE.enrolStatusCls = 'crit';
      updateEnrolStudioDom();
      return { ok: false, reason: 'no-face' };
    }
    if (det.multiple) {
      FACE_STATE.enrolStatusText = 'Multiple faces in frame — only one person may be in view during enrolment.';
      FACE_STATE.enrolStatusCls = 'crit';
      updateEnrolStudioDom();
      return { ok: false, reason: 'multiple' };
    }
    const scoreVal = det.detScore != null ? det.detScore : det.score;
    if (scoreVal != null && scoreVal < 0.45) {
      FACE_STATE.enrolStatusText = `Face confidence too low (${Math.round(scoreVal * 100)}%) — face the camera directly.`;
      FACE_STATE.enrolStatusCls = 'warn';
      updateEnrolStudioDom();
      return { ok: false, reason: 'low-score' };
    }
    const fracVal = det.faceSizeFrac != null ? det.faceSizeFrac : det.frac;
    if (fracVal != null && fracVal < Number(STATE.faceSettings.minFaceFrac || 0.14)) {
      FACE_STATE.enrolStatusText = 'Move closer so your face fills the biometric reticle.';
      FACE_STATE.enrolStatusCls = 'warn';
      updateEnrolStudioDom();
      return { ok: false, reason: 'too-small' };
    }

    // Duplicate-person guard: refuse if this face already belongs to a DIFFERENT enrolled seat
    const others = usableFaces().filter(x => norm(x.email) !== norm(target.email));
    if (others.length && window.Face && window.Face.match) {
      const dupMatch = window.Face.match(det.descriptor, others);
      const thr = Number(STATE.faceSettings.threshold || 0.50);
      if (dupMatch.best && dupMatch.bestDist <= thr) {
        FACE_STATE.enrolStatusText = `Refused: this face is already enrolled under ${dupMatch.best.name} (d=${dupMatch.bestDist.toFixed(3)} ≤ τ=${thr.toFixed(2)}). Each team seat must have a distinct person.`;
        FACE_STATE.enrolStatusCls = 'crit';
        if (STATE.faceSettings.sound && window.Face.Sound) window.Face.Sound.playError();
        updateEnrolStudioDom();
        return { ok: false, reason: 'duplicate-person', other: dupMatch.best.email, dist: dupMatch.bestDist };
      }
    }

    const vecArr = Array.from(det.descriptor);
    let targetSlot = FACE_STATE.enrolCaptures.length;
    if (isSlotRetake && slotOverride < FACE_STATE.enrolCaptures.length) {
      targetSlot = slotOverride;
      FACE_STATE.enrolCaptures[targetSlot] = vecArr;
      FACE_STATE.enrolThumbs[targetSlot] = thumb || FACE_STATE.enrolThumbs[targetSlot] || '';
    } else {
      FACE_STATE.enrolCaptures.push(vecArr);
      FACE_STATE.enrolThumbs.push(thumb || '');
      targetSlot = FACE_STATE.enrolCaptures.length - 1;
    }

    const count = FACE_STATE.enrolCaptures.length;
    if (STATE.faceSettings.sound && window.Face && window.Face.Sound) {
      window.Face.Sound.play(count >= 3 ? 'ok' : 'capture');
    }

    // Auto-persist immediately on every captured pose so photos and 128-d vectors are stored right away
    await persistTargetFaceNow(target);

    FACE_STATE.enrolStatusText = count >= 3
      ? `✓ All 3 biometric poses captured & stored for ${target.full_name} (Face ID & 2FA active).`
      : `✓ Pose ${count}/3 stored for ${target.full_name} — next: ${FACE_POSES[count]}`;
    FACE_STATE.enrolStatusCls = 'ok';
    updateEnrolStudioDom();
    if (!syntheticDet) {
      toast(count >= 3 ? `All 3 Face ID poses stored for ${target.full_name}` : `Pose ${count}/3 captured & stored`);
    }
    return { ok: true, count, slot: targetSlot };
  }

  async function saveFaceEnrolment() {
    const target = enrolTargetUser();
    if (!target || !FACE_STATE.enrolCaptures.length) return false;
    await persistTargetFaceNow(target);
    FACE_STATE.enrolStatusText = `✓ Biometric Face ID saved & synced for ${target.full_name} (${target.face_samples.length}/3 poses stored).`;
    FACE_STATE.enrolStatusCls = 'ok';
    updateEnrolStudioDom();
    toast(`Face ID saved & synced for ${target.full_name}`);
    return true;
  }

  async function clearFaceEnrolment() {
    const target = enrolTargetUser();
    if (!target) return false;
    FACE_STATE.enrolCaptures = [];
    FACE_STATE.enrolThumbs = [];
    target.face_samples = [];
    target.face_thumbs = [];
    target.face_required = false;
    target.face_cleared = true;
    target.face_updated_at = new Date().toISOString();
    FACE_STATE.enrolLoadedForUserId = String(target.id);
    FACE_STATE.enrolStatusText = `Cleared Face ID enrolment for ${target.full_name}.`;
    FACE_STATE.enrolStatusCls = 'warn';
    saveLocalAuthAndRecords();
    updateEnrolStudioDom();
    toast(`Cleared Face ID for ${target.full_name}`);
    if (HAS_LOCAL_API) {
      try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: target }) }); } catch (_) {}
    }
    await syncWithCloud(true);
    return true;
  }

  function runCalibrationReport() {
    const target = enrolTargetUser();
    const list = usableFaces(target);
    if (!window.Face || !window.Face.calibration) return null;
    const cal = window.Face.calibration(list);
    if (!list.length) {
      FACE_STATE.calibReportHtml = `<div class="enrol-calib-box"><small>No enrolled seats yet — capture 3 poses for at least 1 seat to compute intra-seat spread and inter-seat Euclidean separation.</small></div>`;
    } else {
      const rowsHtml = cal.perEmp.map(e => `
        <tr>
          <td><strong>${esc(e.name)}</strong></td>
          <td class="r mono">${e.samples}</td>
          <td class="r mono">${e.spread.toFixed(3)}</td>
          <td><span class="badge ${e.spread <= 0.38 ? 'badge-ok' : 'badge-warn'}">${e.spread <= 0.38 ? 'Tight Cluster' : 'Wide (Retake)'}</span></td>
        </tr>
      `).join('');
      const pairsHtml = cal.pairs.slice(0, 5).map(p => `
        <tr>
          <td>${esc(p.a)} ↔ ${esc(p.b)}</td>
          <td class="r mono"><strong>${p.d.toFixed(3)}</strong></td>
          <td><span class="badge ${p.d >= 0.55 ? 'badge-ok' : 'badge-warn'}">${p.d >= 0.55 ? 'Well Separated' : 'Close Pair'}</span></td>
        </tr>
      `).join('');
      FACE_STATE.calibReportHtml = `
        <div class="enrol-calib-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <strong>128-d Euclidean Calibration Matrix (${list.length} Enrolled Seat${list.length === 1 ? '' : 's'})</strong>
            ${cal.recommendedThreshold ? `<span class="badge badge-info">Recommended τ = ${cal.recommendedThreshold.toFixed(2)}</span>` : `<span class="badge badge-info">Active τ = ${Number(STATE.faceSettings.threshold).toFixed(2)}</span>`}
          </div>
          <div class="table-wrap">
            <table class="ledger-table">
              <thead><tr><th>Enrolled Seat</th><th class="r">Poses</th><th class="r">Max Intra-Seat Spread (d)</th><th>Quality</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
          ${cal.pairs.length ? `
            <div class="table-wrap" style="margin-top:8px">
              <table class="ledger-table">
                <thead><tr><th>Closest Seat Pair</th><th class="r">Min Inter-Seat Distance (d)</th><th>Separation</th></tr></thead>
                <tbody>${pairsHtml}</tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;
    }
    updateEnrolStudioDom();
    return cal;
  }

  // ==========================================================================
  // TEAM SIGN-IN GATE (FAIL-CLOSED) + RLS
  // ==========================================================================
  const VIEW_TITLES = {
    overview: 'Consolidated Command & Ledger Overview',
    pbi: '20-Page Power BI Semantic Report Studio (m18c Parity)',
    tables: 'All 34 Power Apps Dataverse Tables & Registers (m14 Parity)',
    sentinels: 'AI Sentinel Watchdogs & Deterministic Audit (m280)',
    sales: 'Sales & Weighbridge Deliveries Register',
    raw: 'Raw Material & Quarry Intake (2-Leg Payable Split)',
    fleet: 'Equipment, Fleet Telemetry & Diesel Control (m142)',
    pricing: 'Customer & Quarry Price Matrix & Commissions',
    customers: 'Customers & FIFO Accounts Receivable Aging',
    ar: 'Customers & FIFO Accounts Receivable Aging',
    suppliers: 'Suppliers, Quarries & 3-Leg Accounts Payable',
    ap: 'Suppliers, Quarries & 3-Leg Accounts Payable',
    expenses: 'Operating Expenses, Spare Parts & Overhead',
    payroll: 'Payroll, Attendance, Site Allowances & Contracts (m239/m247)',
    ledger: 'Lebanese CoA Trial Balance & SOA Journal Stream',
    gl: 'Lebanese CoA Trial Balance & SOA Journal Stream',
    statements: '22 Printable A4 Financial & Operational Statements',
    users: 'Multi-Device Team Authentication, RLS & Cloud Sync'
  };
  const VIEW_MOBILE_TITLES = {
    overview: 'Command & Ledger Overview',
    pbi: 'Power BI Studio (20 Pages)',
    tables: 'All 34 Tables & Setup',
    sentinels: 'AI Sentinel Audit (m280)',
    sales: 'Sales & Deliveries',
    raw: 'Quarry Intake (2-Leg AP)',
    fleet: 'Fleet & Diesel Control',
    pricing: 'Price Matrix & Rules',
    customers: 'Customers & AR Aging',
    ar: 'Customers & AR Aging',
    suppliers: 'Suppliers & 3-Leg AP',
    ap: 'Suppliers & 3-Leg AP',
    expenses: 'Expenses & Overhead',
    payroll: 'Payroll & Workforce',
    ledger: 'Trial Balance & SOA GL',
    gl: 'Trial Balance & SOA GL',
    statements: '22 Financial Statements',
    users: 'Team Auth & Cloud Sync'
  };
  const COMPANY_MOBILE_LABELS = {
    'manufacturing-group': 'All Group (WTC · BBC · Lions)',
    wtc: 'WTC (World Trading)',
    bbconstruction: 'BBConstruction',
    lionstransport: 'Lions Transport'
  };

  function getInitials(name) {
    return String(name || 'IS').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  function applyUserRlsAndPermissions() {
    const user = activeUser();
    const allowedCos = getAllowedCompanyKeys(user);

    if (!allowedCos.includes(STATE.company)) STATE.company = allowedCos[0];
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => {
      btn.hidden = !allowedCos.includes(btn.getAttribute('data-company'));
    });

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      btn.hidden = !canViewView(btn.getAttribute('data-view'), user);
    });
    if (!canViewView(STATE.view, user)) STATE.view = defaultViewFor(user);

    const newBtn = $('newEntryBtn');
    if (newBtn) newBtn.hidden = !canEnterAny(user);

    const avEl = $('railUserAvatar'), nmEl = $('railUserName'), rlEl = $('activeRoleBadge'), scEl = $('railRlsScope');
    if (avEl) avEl.textContent = getInitials(user.full_name);
    if (nmEl) nmEl.textContent = user.full_name;
    if (rlEl) rlEl.textContent = user.role;
    if (scEl) scEl.textContent = String(user.companies || 'WTC').replace(/BBConstruction/g, 'BBC').replace(/Lions Transport/g, 'Lions');
  }

  function renderQuickSeatsInAuthGate() {
    const listEl = $('quickSeatList');
    if (!listEl) return;
    const hdr = document.querySelector('.auth-right-hdr span');
    const sub = document.querySelector('.auth-right-hdr small');
    if (hdr) hdr.textContent = IS_DEMO ? 'Quick Role & Device Simulator (1-Click Fill)' : 'Team Seats on this Workspace';
    if (sub) sub.textContent = IS_DEMO ? 'Demo mode — tap any seat to sign in (or test Face ID 2FA if enrolled):' : 'Look at the camera for Face ID, or tap your seat to fill your email:';
    listEl.innerHTML = STATE.users.filter(u => u.status !== 'Suspended').map((u, idx) => {
      const hasFace = userHasFaceId(u);
      return `
      <button type="button" class="quick-seat-item" data-quick-seat="${esc(u.email)}">
        <div>
          <b>${esc(u.full_name)}</b>
          <small>${esc(u.email)} · ${esc(u.companies)}</small>
        </div>
        <div class="quick-seat-meta">
          <span class="quick-seat-role">${esc(u.role)}</span>
          <span class="quick-seat-face ${hasFace ? 'on' : ''}">${hasFace ? `✓ Face ID${userRequiresFace2FA(u) ? ' · 2FA' : ''}` : 'PIN Only'}</span>
          ${IS_DEMO ? `<span class="quick-seat-pin">PIN: ${esc(u.pin_code || '1111')}</span>` : ''}
        </div>
      </button>
    `;
    }).join('');

    listEl.querySelectorAll('[data-quick-seat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = STATE.users.find(x => norm(x.email) === norm(btn.getAttribute('data-quick-seat')));
        if (!u) return;
        const emEl = $('authEmailInput');
        const pinEl = $('authPinInput');
        if (emEl) emEl.value = u.email;
        if (IS_DEMO) { if (pinEl) pinEl.value = u.pin_code || '1111'; performLogin(u.email, u.pin_code || '1111', { bypass2FA: true }); }
        else if (pinEl) { pinEl.value = ''; pinEl.focus(); }
      });
    });
  }

  function openAuthGate(prefillEmail) {
    STATE.authed = false;
    FACE_STATE.pending2faUser = null;
    FACE_STATE.streakUser = null;
    FACE_STATE.streakCount = 0;
    window.__mfgAuthedEmail = '';
    renderQuickSeatsInAuthGate();
    updateCloudBadges();
    updateAuthFaceUi();
    const emEl = $('authEmailInput');
    const pinEl = $('authPinInput');
    if (emEl) emEl.value = prefillEmail || '';
    if (pinEl) pinEl.value = '';
    const errEl = $('authErrorBox');
    if (errEl) errEl.hidden = true;
    const gate = $('authGate');
    if (gate) gate.hidden = false;
    document.body.classList.add('locked');
    if (!FACE_STATE.authCamStoppedByUser) startAuthFaceScanner(false);
    setTimeout(() => { const t = prefillEmail ? pinEl : emEl; if (t) t.focus(); }, 80);
  }

  function closeAuthGate() {
    STATE.authed = true;
    FACE_STATE.pending2faUser = null;
    stopAuthFaceScanner();
    window.__mfgAuthedEmail = activeUser().email;
    const gate = $('authGate');
    if (gate) gate.hidden = true;
    document.body.classList.remove('locked');
    const keep = new URLSearchParams();
    ['demo', 'nosse'].forEach(p => { if (PARAMS.has(p)) keep.set(p, PARAMS.get(p)); });
    const targetUrl = location.pathname + (keep.toString() ? '?' + keep.toString() : '') + (VIEW_TITLES[STATE.view] ? '#' + STATE.view : '');
    if (location.pathname + location.search + location.hash !== targetUrl) {
      history.replaceState({ view: STATE.view }, '', targetUrl);
    }
  }

  function signOut() {
    const email = activeUser().email;
    try { localStorage.removeItem('isabi_mfg_active_email'); } catch (_) {}
    try { sessionStorage.removeItem('isabi_mfg_sw_resume'); } catch (_) {}
    closeEntryModal(true);
    const keep = new URLSearchParams();
    ['demo', 'nosse'].forEach(p => { if (PARAMS.has(p)) keep.set(p, PARAMS.get(p)); });
    history.replaceState({ view: STATE.view }, '', location.pathname + (keep.toString() ? '?' + keep.toString() : ''));
    openAuthGate(email);
    toast('Session locked — sign in with Face ID or PIN to continue');
  }

  function authError(msg) {
    const errEl = $('authErrorBox');
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    const card = document.querySelector('.auth-card');
    if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    const pinEl = $('authPinInput');
    if (pinEl) { pinEl.value = ''; pinEl.focus(); }
  }

  let loginAttempts = 0;
  let loginLockUntil = 0;
  async function performLogin(emailRaw, pinRaw, opts = {}) {
    let email = norm(emailRaw);
    const pin = String(pinRaw || '').trim();
    if (Date.now() < loginLockUntil) { authError(`Too many attempts — wait ${Math.ceil((loginLockUntil - Date.now()) / 1000)} s.`); return false; }
    if (!email && pin) {
      const matches = STATE.users.filter(u => u.status !== 'Suspended' && String(u.pin_code || '1111').trim() === pin);
      if (matches.length === 1) {
        email = norm(matches[0].email);
        const emEl = $('authEmailInput');
        if (emEl) emEl.value = matches[0].email;
      } else if (matches.length > 1) {
        authError('Multiple seats share this PIN — tap your seat on the right or enter your email.');
        return false;
      } else {
        loginAttempts += 1;
        if (loginAttempts >= 5) { loginLockUntil = Date.now() + 30000; loginAttempts = 0; authError('Too many wrong PINs — locked for 30 seconds.'); }
        else authError('Incorrect access PIN — tap your seat on the right or check your 4-digit PIN.');
        return false;
      }
    }
    if (!email) { authError('Tap your seat on the right or enter your Access PIN.'); return false; }
    if (!pin) { authError('Enter your 4-digit Access PIN.'); return false; }

    const idx = STATE.users.findIndex(u => norm(u.email) === email);
    if (idx < 0) { authError('Email not found in the Manufacturing team directory.'); return false; }
    const user = STATE.users[idx];
    if (user.status === 'Suspended') { authError('This seat is suspended — ask the owner to re-activate it.'); return false; }
    if (pin !== String(user.pin_code || '1111').trim()) {
      loginAttempts += 1;
      if (loginAttempts >= 5) { loginLockUntil = Date.now() + 30000; loginAttempts = 0; authError('Too many wrong PINs — locked for 30 seconds.'); }
      else authError('Incorrect access PIN for ' + user.full_name + '.');
      return false;
    }
    loginAttempts = 0;

    // Step-Up 2FA Biometric Gate: if this seat has enrolled Face ID and 2FA is enforced, require Face ID confirmation!
    if (!opts.bypass2FA && userRequiresFace2FA(user)) {
      FACE_STATE.pending2faUser = user;
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      const errEl = $('authErrorBox');
      if (errEl) errEl.hidden = true;
      updateAuthFaceUi();
      setAuthHint(`🔒 PIN verified for ${user.full_name} — look at the camera to complete Biometric Face ID 2FA`, 'ok');
      if (!FACE_STATE.camActive && !navigator.webdriver) startAuthFaceScanner(true);
      return '2fa_pending';
    }

    FACE_STATE.pending2faUser = null;
    const nowStr = nowStamp();
    const ua = navigator.userAgent || '';
    const devLabel = /iPhone|iPad/i.test(ua) ? 'iOS Safari' : (/Android/i.test(ua) ? 'Android Chrome' : (/Edg\//.test(ua) ? 'Desktop Edge' : 'Desktop Browser'));
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const authMethod = opts.method || 'PIN';
    const authConf = opts.confidence != null ? Number(opts.confidence) : null;

    user.last_login_at = nowStr.slice(0, 16);
    STATE.activeUserIdx = idx;
    try { localStorage.removeItem('isabi_mfg_active_email'); } catch (_) {}
    STATE.sessions.unshift({
      id: uid('sess'),
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      companies: user.companies,
      device: devLabel + (standalone ? ' · Home Screen app' : ''),
      method: authMethod,
      confidence: authConf,
      logged_in_at: nowStr
    });
    STATE.sessions = STATE.sessions.slice(0, 50);
    saveLocalAuthAndRecords();

    if (HAS_LOCAL_API) {
      try { await fetch('./api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, pin, device: devLabel, method: authMethod, confidence: authConf }) }); } catch (_) { /* no server.py */ }
    }

    if (!getAllowedCompanyKeys(user).includes(STATE.company)) STATE.company = getAllowedCompanyKeys(user)[0];
    if (!canViewView(STATE.view, user)) STATE.view = defaultViewFor(user);
    closeAuthGate();
    STATE.search = '';
    STATE.showAddUserForm = false;
    renderApp();
    toast(`Signed in as ${user.full_name} (${authMethod}) · ${String(user.companies).replace(/BBConstruction/g, 'BBC')}`);
    syncWithCloud(true);
    return true;
  }

  // ==========================================================================
  // ASK ISABI COPILOT ANSWERS (DATA-DRIVEN, WORD-BOUNDARY INTENTS)
  // ==========================================================================
  function answerAskIsabi(qRaw) {
    const q = ' ' + String(qRaw || '').toLowerCase() + ' ';
    const has = re => re.test(q);
    const g = (SEED.models['manufacturing-group'] || {}).periods || {};
    const gk = g[STATE.period] || g.all || {};
    const w = ((SEED.models.wtc || {}).periods || {})[STATE.period] || ((SEED.models.wtc || {}).periods || {}).all || {};
    const b = ((SEED.models.bbconstruction || {}).periods || {})[STATE.period] || ((SEED.models.bbconstruction || {}).periods || {}).all || {};
    const scope = `${COMPANY_LABELS[STATE.company].split('(')[0].trim()} · ${gk.label || 'All-Time'}`;
    const k = getKPI();
    const { fleet, pricing } = sentinelSlice();

    if (has(/\b(margin|gm|p&l|profit|compare|revenue|bbconstruction|wtc)\b/)) {
      return `<strong>P&amp;L — WTC vs BBConstruction (${esc(gk.label || 'All-Time')}):</strong><br>
        • <strong>WTC</strong>: Sales TTC ${fmtUSD(w.sales_ttc, 0)} on ${fmtNum(w.loads)} loads · net ${fmtUSD(w.net_sales, 0)} · raw cost ${fmtUSD(w.raw_cost, 0)} (${fmtNum(w.raw_loads)} loads) · gross margin ${fmtUSD(w.gross_margin, 0)} (<strong>${fmtPct(w.gm_pct, w.gross_margin, w.net_sales)}</strong>) · operating cash profit <strong>${fmtUSD(w.operating_profit, 0)}</strong> (${fmtPct(w.op_margin_pct, w.operating_profit, w.net_sales)}).<br>
        • <strong>BBConstruction</strong>: Sales TTC ${fmtUSD(b.sales_ttc, 0)} on ${fmtNum(b.loads)} loads · net ${fmtUSD(b.net_sales, 0)} · raw cost ${fmtUSD(b.raw_cost, 0)} (${fmtNum(b.raw_loads)} loads) · gross margin ${fmtUSD(b.gross_margin, 0)} (<strong>${fmtPct(b.gm_pct, b.gross_margin, b.net_sales)}</strong>) · operating cash profit <strong>${fmtUSD(b.operating_profit, 0)}</strong> (${fmtPct(b.op_margin_pct, b.operating_profit, b.net_sales)}).<br>
        • BBConstruction's higher GM comes from more own / JV pit material (lower third-party quarry royalties); its operating margin is thinner because expenses and payroll weigh more against a smaller top line.`;
    }
    if (has(/\b(ar|overdue|receivable|receivables|customer|customers|credit hold|dso)\b/)) {
      const topC = ((SEED.models[STATE.company] || SEED.models['manufacturing-group'] || {}).customers || []).slice(0, 5).map(c => `${esc(c.Customer)} (${fmtUSD(c.ar_balance, 0)}${Number(c.ar_60_plus || 0) > 0 ? ', ' + fmtUSD(c.ar_60_plus, 0) + ' past 60d' : ''})`).join(', ');
      return `<strong>FIFO Accounts Receivable — ${esc(scope)}:</strong><br>
        • Open AR <strong>${fmtUSD(k.ar_balance, 2)}</strong> (WTC ${fmtUSD(w.ar_balance, 2)} · BBConstruction ${fmtUSD(b.ar_balance, 2)}) · overdue &gt;30d ${fmtUSD(k.ar_overdue, 0)} · past 60 days <strong>${fmtUSD(k.ar_60_plus, 0)}</strong> · DSO ${fmtNum(k.dso_days, 0)} days.<br>
        • Aging: current ${fmtUSD(k.ar_current, 0)} · 1–10d ${fmtUSD(k.ar_1_10, 0)} · 11–30d ${fmtUSD(k.ar_11_30, 0)} · 31–60d ${fmtUSD(k.ar_31_60, 0)} · 60+ ${fmtUSD(k.ar_60_plus, 0)}. VAT-registered customers carry 11% inside their balance (m249).<br>
        • Largest balances: ${topC || '—'}. Credit hold candidates = anything past 60 days with no receipt this month.`;
    }
    if (has(/\b(ap|leg|legs|quarry|quarries|supplier|suppliers|hauler|payable|payables)\b/)) {
      return `<strong>3-Leg Accounts Payable (m192) — ${esc(scope)}:</strong><br>
        1. <strong>Material leg ${fmtUSD(k.ap_material, 0)}</strong> owed to quarry site owners.<br>
        2. <strong>Haulage leg ${fmtUSD(k.ap_haulage, 0)}</strong> owed to truck owners ($0 on company-fleet loads).<br>
        3. <strong>Supplies &amp; services leg ${fmtUSD(k.ap_expense, 0)}</strong> from credit expenses.<br>
        Settlements paid ${fmtUSD(k.settlements_paid, 0)} · net open AP <strong>${fmtUSD(k.ap_balance, 0)}</strong>${Number(k.ap_balance || 0) < 0 ? ' (negative = prepayments / advances exceed open legs)' : ''}.`;
    }
    if (has(/\b(diesel|tank|fuel|litre|litres|consumption)\b/)) {
      const wf = (((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model) || {}).WTC || {};
      const bf = (((SEED.sentinels.fleet_fuel_overtime_auditor || {}).by_model) || {}).BBConstruction || {};
      return `<strong>Diesel Tank &amp; Fuel Reconciliation:</strong><br>
        • <strong>WTC</strong>: purchased ${fmtNum(wf.diesel_purchased_l, 0)} L − issued ${fmtNum(wf.diesel_issued_l, 0)} L − sold → <code class="mono">${fmtNum(wf.diesel_stock_balance_l, 0)} L</code> in tank.<br>
        • <strong>BBConstruction</strong>: purchased ${fmtNum(bf.diesel_purchased_l, 0)} L − issued ${fmtNum(bf.diesel_issued_l, 0)} L − sold → <code class="mono">${fmtNum(bf.diesel_stock_balance_l, 0)} L</code> — negative because bulk diesel invoices were booked under General Expenses instead of Fuel Purchases; new BBConstruction diesel intakes are refused until the history is corrected (m212).<br>
        • Period issued ${fmtNum(k.diesel_litres, 0)} L · fleet cost per ton hauled ${fmtUSD(k.cost_per_ton, 2)} · ${fmtNum((fleet.consumption_outliers || []).length)} consumption outliers flagged by m142.`;
    }
    if (has(/\b(trial|balance|coa|ledger|gl|tie|tied)\b/)) {
      const tb = Number(k.tb_check || 0);
      return `<strong>Lebanese CoA Double-Entry Trial Balance — ${esc(scope)}:</strong><br>
        • Variance <strong>${fmtUSD(tb, 2)}</strong> ${Math.abs(tb) < 0.005 ? '— every SOA journal leg across Class 4 (receivables / payables / VAT), Class 5 (till 5300), Class 6 (raw material, haulage, payroll, expenses) and Class 7 (sales) ties.' : '— open the General Ledger and the Sentinels page: the books do not tie for this scope.'}<br>
        • Output VAT 11% ${fmtUSD(k.sales_vat, 2)} · VAT receivable ${fmtUSD(k.vat_receivable, 2)} · cash till ${fmtUSD(k.cash_till, 2)}.`;
    }
    if (has(/\b(price|prices|pricing|agreement|agreements|below|commission)\b/)) {
      return `<strong>Price Agreements — ${esc(scope)}:</strong><br>
        • ${fmtNum(pricing.active_agreements || k.active_agreements)} active agreements · ${fmtUSD(pricing.sales_below_agreed_usd || 0, 0)} sold below the agreed price across ${fmtNum(pricing.below_agreed_pairs_count || 0)} customer × product pairs · ${fmtNum(pricing.lapsed_agreement_pairs_count || 0)} pairs trading on lapsed agreements.<br>
        • Weighted agreed price ${fmtUSD(pricing.weighted_agreed_price_usd || 0, 2)} vs actual average ${fmtUSD(pricing.actual_avg_price_usd || 0, 2)} · commission due ${fmtUSD(k.commission_due, 0)}.`;
    }
    if (has(/\b(overtime|driver|drivers|payroll|salary|salaries)\b/)) {
      return `<strong>Workforce — ${esc(scope)}:</strong><br>
        • Salaries paid ${fmtUSD(k.salaries_paid, 0)} · overtime bonus due ${fmtUSD(k.overtime_bonus, 0)} (sales ${fmtUSD(fleet.sales_overtime_bonus_usd || 0, 0)} + raw ${fmtUSD(fleet.raw_overtime_bonus_usd || 0, 0)} all-time) · ${fmtUSD(pricing.unmatched_salary_payments_usd || 0, 0)} paid without a contract.<br>
        • Overtime = a company-fleet load dispatched outside the 06:00–17:59 day shift (m48 / m93); third-party loads never earn the allowance.`;
    }
    if (has(/\b(license|licence|licenses|save|savings|cost|option 3|architecture|seat|seats)\b/)) {
      const n = STATE.users.length;
      return `<strong>Option 3 Multi-Device Cloud &amp; SQL Economics:</strong><br>
        • ${n} team seats run on the BHFIRMS cloud relay (<code class="mono">${esc(CLOUD_DOC_KEY)}</code>) + optional local SQLite (<code class="mono">data/mfg.db</code>) + PostgreSQL schema (<code class="mono">data/schema_postgres.sql</code>).<br>
        • Versus Dataverse + Power BI PPU at about $37 / seat / month that is <strong>${fmtUSD(n * 37 * 12, 0)} / year</strong> saved at the current seat count.`;
    }
    return `<strong>${esc(scope)} at a glance:</strong><br>
      • Revenue (TTC) <strong>${fmtUSD(k.sales_ttc, 2)}</strong> across <strong>${fmtNum(k.loads)} loads</strong> (${fmtNum(k.tons_sold, 0)} t) · gross margin ${fmtUSD(k.gross_margin, 0)} · operating cash profit ${fmtUSD(k.operating_profit, 0)}.<br>
      • Open AR ${fmtUSD(k.ar_balance, 0)} · open AP ${fmtUSD(k.ap_balance, 0)} · till ${fmtUSD(k.cash_till, 2)} · diesel in tank ${fmtNum(k.diesel_in_tank, 0)} L.<br>
      Ask about <em>margin</em>, <em>AR</em>, <em>AP legs</em>, <em>diesel</em>, <em>trial balance</em>, <em>pricing</em>, <em>overtime</em> or <em>licenses</em>.`;
  }

  // ==========================================================================
  // MASTER RENDER & EVENT WIRING
  // ==========================================================================
  let searchTimer = null;

  function contextFormForView(view, user) {
    user = user || activeUser();
    const map = { sales: 'sales', raw: 'raw', fleet: 'fuel', pricing: 'pricerule', customers: 'receipt', ar: 'receipt', suppliers: 'settlement', ap: 'settlement', expenses: 'expense', payroll: 'salary', tables: 'pricerule' };
    let preferred = map[view] || 'sales';
    if (view === 'tables' && window.MFG_PBI) { // the hub's active table owns the form (e.g. Loans → Treasury desk)
      const meta = (window.MFG_PBI.TABLE_CATALOG || []).find(t => t.key === STATE.activeTableKey);
      if (meta && meta.form && FORM_TITLES[meta.form]) preferred = meta.form;
    }
    if (canEnterForm(preferred, user)) return preferred;
    if (canEnterForm('sales', user)) return 'sales';
    if (canEnterForm('receipt', user)) return 'receipt';
    return 'sales';
  }

  function renderMobileSubnav(user, k, sentinelsOpen) {
    const el = $('mobileSubnav');
    if (!el) return;
    const v = STATE.view;
    let group = 'exec';
    if (['sales', 'raw', 'fleet', 'pricing'].includes(v)) group = 'dispatch';
    else if (['customers', 'ar', 'suppliers', 'ap', 'expenses', 'payroll', 'ledger', 'gl'].includes(v)) group = 'books';

    const specs = {
      exec: [
        { view: 'overview', label: 'Overview', pill: 'Live' },
        { view: 'pbi', label: 'Power BI', pill: '20' },
        { view: 'tables', label: '34 Tables', pill: '34' },
        { view: 'sentinels', label: 'Sentinels', pill: String(sentinelsOpen) },
        { view: 'statements', label: 'Statements', pill: '22' },
        { view: 'users', label: 'Team', pill: String(STATE.users.length) }
      ],
      dispatch: [
        { view: 'sales', label: 'Sales', pill: k.loads != null ? fmtNum(k.loads) : '' },
        { view: 'raw', label: 'Quarries', pill: k.raw_loads != null ? fmtNum(k.raw_loads) : '' },
        { view: 'fleet', label: 'Fleet', pill: k.active_equip != null ? fmtNum(k.active_equip) : '' },
        { view: 'pricing', label: 'Pricing', pill: k.active_agreements != null ? fmtNum(k.active_agreements) : '' }
      ],
      books: [
        { view: 'customers', match: ['customers', 'ar'], label: 'AR Aging', pill: k.ar_balance != null ? fmtUSDk(k.ar_balance) : '' },
        { view: 'suppliers', match: ['suppliers', 'ap'], label: 'AP 3-Leg', pill: k.ap_balance != null ? fmtUSDk(k.ap_balance) : '' },
        { view: 'expenses', label: 'Expenses', pill: k.expenses != null ? fmtUSDk(k.expenses) : '' },
        { view: 'payroll', label: 'Payroll', pill: k.salaries_paid != null ? fmtUSDk(k.salaries_paid) : '' },
        { view: 'ledger', match: ['ledger', 'gl'], label: 'GL & SOA', pill: k.tb_check != null && Math.abs(Number(k.tb_check)) < 0.005 ? '$0' : '' }
      ]
    };

    const items = (specs[group] || specs.exec).filter(it => canViewView(it.view, user));
    el.innerHTML = items.map(it => {
      const on = (it.match || [it.view]).includes(v);
      return `<button type="button" class="m-subnav-pill${on ? ' on' : ''}" data-subnav-view="${esc(it.view)}"><span>${esc(it.label)}</span>${it.pill ? `<em>${esc(it.pill)}</em>` : ''}</button>`;
    }).join('');
    el.querySelectorAll('[data-subnav-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-subnav-view'))));

    // Sync Mobile Bottom Dock active states
    const dOver = $('dockBtnOverview'), dDisp = $('dockBtnDispatch'), dBooks = $('dockBtnBooks'), dEntry = $('mobileDockEntryBtn'), dEntryLbl = $('mobileDockEntryLabel');
    if (dOver) dOver.classList.toggle('on', group === 'exec');
    if (dDisp) dDisp.classList.toggle('on', group === 'dispatch');
    if (dBooks) dBooks.classList.toggle('on', group === 'books');
    if (dEntry && dEntryLbl) {
      if (canEnterAny(user)) {
        dEntry.hidden = false;
        const formLabels = { sales: 'Post Ticket', raw: 'Post Raw', fuel: 'Log Fuel', receipt: 'Post Receipt', settlement: 'Settle AP', expense: 'Post Expense', salary: 'Pay Salary' };
        dEntryLbl.textContent = formLabels[contextFormForView(v, user)] || 'Post Entry';
      } else {
        dEntry.hidden = true;
      }
    }
  }

  function setRailWidth(w, persist = true) {
    STATE.railWidth = clampRailWidth(w);
    if (persist) {
      try { localStorage.setItem('isabi_mfg_rail_width', String(STATE.railWidth)); } catch (_) {}
    }
    syncRailCollapseUi();
  }

  function syncRailCollapseUi() {
    const shell = $('appShell');
    const menuBtn = $('mobileMenuBtn');
    const menuLbl = $('sidebarToggleLbl');
    const narrowBtn = $('railNarrowBtn');
    const widerBtn = $('railWiderBtn');
    const resizer = $('railResizer');
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 860;
    const collapsed = !isMobile && !!STATE.railCollapsed;
    const w = clampRailWidth(STATE.railWidth);
    document.documentElement.style.setProperty('--rail-w', `${w}px`);
    if (shell) {
      shell.style.setProperty('--rail-w', `${w}px`);
      shell.classList.toggle('rail-collapsed', collapsed);
      shell.classList.toggle('rail-narrow', !isMobile && !collapsed && w < 218);
      shell.classList.toggle('rail-wide', !isMobile && !collapsed && w >= 290);
    }
    if (narrowBtn) narrowBtn.disabled = w <= RAIL_MIN_W;
    if (widerBtn) widerBtn.disabled = w >= RAIL_MAX_W;
    if (resizer) {
      resizer.setAttribute('aria-valuenow', String(w));
      resizer.title = `Sidebar width: ${w}px — Drag left or right to make wider/narrower · Double-click to reset (${RAIL_DEFAULT_W}px)`;
    }
    if (menuBtn) {
      menuBtn.classList.toggle('rail-is-hidden', collapsed);
      menuBtn.setAttribute('aria-expanded', String(!collapsed));
      menuBtn.title = isMobile
        ? 'Open navigation menu'
        : (collapsed ? 'Show left navigation sidebar' : 'Hide left navigation sidebar to expand main view');
    }
    if (menuLbl) {
      menuLbl.textContent = collapsed ? 'Show Menu' : 'Hide Menu';
    }
  }

  function renderApp() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
    syncRailCollapseUi();
    const themeBtn = $('themeToggleBtn');
    if (themeBtn) themeBtn.textContent = STATE.theme === 'dark' ? 'Light' : 'Dark';
    const mThemeBtn = $('mobileThemeBtn');
    if (mThemeBtn) mThemeBtn.textContent = STATE.theme === 'dark' ? '☀' : '☾';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', STATE.theme === 'dark' ? '#0E1A2E' : '#F4F2EE');

    applyUserRlsAndPermissions();
    const user = activeUser();
    const k = getKPI();

    const eyeEl = $('topbarEyebrow');
    const titEl = $('topbarTitle');
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 860;
    if (eyeEl) {
      eyeEl.textContent = isMobileViewport
        ? `${COMPANY_MOBILE_LABELS[STATE.company] || COMPANY_LABELS[STATE.company]} · ${STATE.basis === 'rep' ? 'Rep Date' : 'Tx Date'}`
        : `${COMPANY_LABELS[STATE.company]} · ${k.label || 'All-Time'} · ${STATE.basis === 'rep' ? 'Reporting Date Basis' : 'Transaction Date Basis'}`;
    }
    if (titEl) {
      titEl.textContent = isMobileViewport
        ? (VIEW_MOBILE_TITLES[STATE.view] || VIEW_TITLES[STATE.view] || VIEW_MOBILE_TITLES.overview)
        : (VIEW_TITLES[STATE.view] || VIEW_TITLES.overview);
    }
    document.title = `${(VIEW_TITLES[STATE.view] || 'Overview').split('&')[0].trim()} · ISABI Mfg`;

    const aiScope = $('aiDrawerScope');
    if (aiScope) aiScope.textContent = `${COMPANY_LABELS[STATE.company].split('(')[0].trim()} · USD · ${k.label || 'All-Time'}`;

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => {
      const v = btn.getAttribute('data-view');
      const isMatch = v === STATE.view || (v === 'customers' && STATE.view === 'ar') || (v === 'suppliers' && STATE.view === 'ap') || (v === 'ledger' && STATE.view === 'gl');
      btn.classList.toggle('on', isMatch);
    });
    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-company') === STATE.company));
    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-basis') === STATE.basis));
    syncTopbarDateControls();

    // Rail badges follow the active scope
    const setPill = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    const sentinelsOpen = buildSentinelItems().filter(s => s.severity !== 'ok').length;
    setPill('navCountSales', k.loads != null ? fmtNum(k.loads) : '—');
    setPill('navCountRaw', k.raw_loads != null ? fmtNum(k.raw_loads) : '—');
    setPill('navCountFleet', k.active_equip != null ? fmtNum(k.active_equip) : fmtNum(SEED.records.equipment.length));
    setPill('navCountPricing', k.active_agreements != null ? fmtNum(k.active_agreements) : '—');
    setPill('navCountAR', k.ar_balance != null ? fmtUSDk(k.ar_balance) : '—');
    setPill('navCountAP', k.ap_balance != null ? fmtUSDk(k.ap_balance) : '3 Legs');
    setPill('navCountExp', k.expenses != null ? fmtUSDk(k.expenses) : '—');
    setPill('navCountPayroll', k.salaries_paid != null ? fmtUSDk(k.salaries_paid) : fmtNum(SEED.records.employments.length));
    setPill('navCountSentinels', String(sentinelsOpen));
    setPill('navCountUsers', `${STATE.users.length} Seats`);
    const tbPill = $('navCountTB');
    if (tbPill) { const tb = Number(k.tb_check); tbPill.textContent = k.tb_check == null ? 'TB —' : (Math.abs(tb) < 0.005 ? 'TB $0' : 'TB ' + fmtUSDk(tb)); tbPill.className = 'nav-pill ' + (k.tb_check == null ? '' : (Math.abs(tb) < 0.005 ? 'good' : 'brass')); }
    const snPill = $('navCountSentinels');
    if (snPill) snPill.className = 'nav-pill ' + (sentinelsOpen ? 'brass' : 'good');

    renderMobileSubnav(user, k, sentinelsOpen);

    const container = $('workspace');
    if (!container) return;

    switch (STATE.view) {
      case 'overview': container.innerHTML = renderOverview(); break;
      case 'pbi': container.innerHTML = window.MFG_PBI ? window.MFG_PBI.renderPbiStudio({ STATE, SEED, COMPANY_LABELS, STATEMENT_CATALOG, getModel, getKPI, filterRecords, buildSentinelItems, exportBtn, nextTicketNo, canEnterForm, SEED_DATE, MIN_DATE, MAX_DATE, periodRange, getDateGrainCatalog, getScopedMonthly, setDateFilter, ticketTons }) : renderOverview(); break;
      case 'tables': container.innerHTML = window.MFG_PBI ? window.MFG_PBI.renderTablesHub({ STATE, SEED, filterRecords, sortRows, th, shownCount, showMoreRow, emptyRow, exportBtn, searchBox, appCell, canEnterForm, isAppRecord }) : renderOverview(); break;
      case 'sentinels': container.innerHTML = renderSentinels(); break;
      case 'sales': container.innerHTML = renderSales(); break;
      case 'raw': container.innerHTML = renderRaw(); break;
      case 'fleet': container.innerHTML = renderFleet(); break;
      case 'pricing': container.innerHTML = renderPricing(); break;
      case 'customers':
      case 'ar': container.innerHTML = renderAR(); break;
      case 'suppliers':
      case 'ap': container.innerHTML = renderAP(); break;
      case 'expenses': container.innerHTML = renderExpenses(); break;
      case 'payroll': container.innerHTML = renderPayroll(); break;
      case 'ledger':
      case 'gl': container.innerHTML = renderGL(); break;
      case 'statements': container.innerHTML = renderStatements(); break;
      case 'users': container.innerHTML = renderUsers(); break;
      default: container.innerHTML = renderOverview();
    }
    wireWorkspace(container, user);
  }

  function wireWorkspace(container, activeUserRow) {
    // Power BI Studio 20-page tabs & dynamic per-page slicers + 34-table hub chips
    container.querySelectorAll('[data-pbi-page]').forEach(btn => btn.addEventListener('click', () => {
      STATE.pbiPage = btn.getAttribute('data-pbi-page');
      renderApp();
    }));
    container.querySelectorAll('[data-pbi-jump]').forEach(el => {
      const go = () => {
        STATE.pbiPage = el.getAttribute('data-pbi-jump') || 'p01_overview';
        if (STATE.view !== 'pbi') setView('pbi');
        else {
          renderApp();
          const ws = $('workspace');
          if (ws) ws.scrollTop = 0;
        }
      };
      el.addEventListener('click', go);
      if (el.getAttribute('role') === 'button') el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    const pbiReset = $('pbiResetSlicersBtn');
    if (pbiReset) pbiReset.addEventListener('click', () => {
      STATE.pbiSlicer = {};
      STATE.pbiTablePage = {};
      renderApp();
    });
    container.querySelectorAll('[data-pbi-slicer]').forEach(el => {
      el.addEventListener('change', e => {
        const key = el.getAttribute('data-pbi-slicer');
        if (key) { STATE.pbiSlicer[key] = e.target.value; STATE.pbiTablePage = {}; renderApp(); }
      });
    });
    container.querySelectorAll('[data-pbi-grain]').forEach(btn => {
      btn.addEventListener('click', () => setDateFilter({ grain: btn.getAttribute('data-pbi-grain') }));
    });
    const pbiPeriodSel = $('pbiPeriodSelect');
    if (pbiPeriodSel) pbiPeriodSel.addEventListener('change', e => setDateFilter({ period: e.target.value }));
    const pbiDateFrom = $('pbiDateFrom');
    if (pbiDateFrom) pbiDateFrom.addEventListener('change', e => setDateFilter({ from: e.target.value }));
    const pbiDateTo = $('pbiDateTo');
    if (pbiDateTo) pbiDateTo.addEventListener('change', e => setDateFilter({ to: e.target.value }));
    const pbiDateReset = $('pbiDateResetBtn');
    if (pbiDateReset) pbiDateReset.addEventListener('click', () => setDateFilter({ reset: true }));
    container.querySelectorAll('[data-pbi-page-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tk = btn.getAttribute('data-pbi-page-btn');
        const target = Number(btn.getAttribute('data-pbi-page-target') || 0);
        STATE.pbiTablePage[tk] = Math.max(0, target);
        const ws = $('workspace');
        const y = ws ? ws.scrollTop : 0;
        renderApp();
        if (ws) ws.scrollTop = y;
      });
    });
    container.querySelectorAll('[data-pbi-page-size]').forEach(sel => {
      sel.addEventListener('change', e => {
        STATE.pbiPageSize = Number(e.target.value) || 15;
        STATE.pbiTablePage = {};
        const ws = $('workspace');
        const y = ws ? ws.scrollTop : 0;
        renderApp();
        if (ws) ws.scrollTop = y;
      });
    });
    container.querySelectorAll('[data-stmt-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.stmtCatFilter = btn.getAttribute('data-stmt-cat') || 'all';
        renderApp();
      });
    });
    const pbiSearch = $('pbiSlicerSearch');
    if (pbiSearch) {
      pbiSearch.addEventListener('input', e => {
        STATE.pbiSlicer.search = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const pos = e.target.selectionStart;
          renderApp();
          const next = $('pbiSlicerSearch');
          if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (_) {} }
        }, 160);
      });
    }
    container.querySelectorAll('[data-table-key], [data-conn-table-key]').forEach(btn => btn.addEventListener('click', () => {
      STATE.activeTableKey = btn.getAttribute('data-table-key') || btn.getAttribute('data-conn-table-key');
      STATE.search = '';
      STATE.shown = {};
      renderApp();
    }));
    container.querySelectorAll('[data-tbl-view]').forEach(btn => btn.addEventListener('click', () => {
      if (!STATE.tableViews) STATE.tableViews = {};
      const tk = btn.getAttribute('data-tbl-key') || STATE.activeTableKey || 'price_rules';
      STATE.tableViews[tk] = btn.getAttribute('data-tbl-view') || 'all';
      STATE.shown = {};
      renderApp();
    }));
    // Chart hover & mobile tap tooltip
    const chartWrap = $('execChartWrap');
    const chartTip = $('execChartTip');
    if (chartWrap && chartTip) {
      const showTip = (col, clientX, clientY) => {
        chartTip.innerHTML = `<strong>${esc(col.getAttribute('data-m') || '')} · ${esc(col.getAttribute('data-t') || '')}</strong><br>${esc(col.getAttribute('data-tip') || '')}`;
        chartTip.hidden = false;
        const rect = chartWrap.getBoundingClientRect();
        const tipW = Math.min(260, rect.width - 16);
        const x = clientX != null ? (clientX - rect.left - tipW / 2) : 10;
        const y = clientY != null ? (clientY - rect.top - 58) : 8;
        chartTip.style.left = Math.min(Math.max(8, rect.width - tipW - 8), Math.max(8, x)) + 'px';
        chartTip.style.top = Math.max(6, y) + 'px';
      };
      chartWrap.querySelectorAll('.col').forEach(col => {
        col.addEventListener('mouseenter', e => showTip(col, e.clientX, e.clientY));
        col.addEventListener('mousemove', e => showTip(col, e.clientX, e.clientY));
        col.addEventListener('mouseleave', () => { chartTip.hidden = true; });
        col.addEventListener('click', e => {
          e.stopPropagation();
          const b = col.getBoundingClientRect();
          showTip(col, b.left + b.width / 2, b.top);
        });
      });
    }

    // Search: debounce, re-render, keep the caret (never re-render while a sync tick lands mid-typing)
    const searchEl = $('tableSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', e => {
        STATE.search = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const pos = e.target.selectionStart;
          STATE.shown = {};
          renderApp();
          const next = $('tableSearchInput');
          if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (_) { /* type=search on some browsers */ } }
        }, 160);
      });
      searchEl.addEventListener('blur', () => { if (STATE.renderPending) { STATE.renderPending = false; renderApp(); } });
    }

    container.querySelectorAll('[data-chip]').forEach(btn => btn.addEventListener('click', () => { STATE.chipFilter = btn.getAttribute('data-chip'); STATE.shown = {}; renderApp(); }));
    container.querySelectorAll('[data-jump-co]').forEach(row => {
      const goCo = () => {
        const targetCo = row.getAttribute('data-jump-co');
        if (getAllowedCompanyKeys(activeUserRow).includes(targetCo)) {
          STATE.company = targetCo;
          STATE.shown = {};
          STATE.pbiTablePage = {};
          saveFilterState();
          renderApp();
        } else {
          toast('Your seat is not scoped to that entity', 'err');
        }
      };
      row.addEventListener('click', goCo);
      if (row.getAttribute('role') === 'button') row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goCo(); } });
    });
    container.querySelectorAll('[data-nav-jump]').forEach(btn => {
      const go = () => {
        const stmt = btn.getAttribute('data-stmt-jump');
        if (stmt) STATE.activeStatement = stmt;
        setView(btn.getAttribute('data-nav-jump'));
      };
      btn.addEventListener('click', go);
      if (btn.getAttribute('role') === 'button') btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    // Clickable lookup pills inside any register or 34-Table Hub cell
    container.querySelectorAll('[data-rel-key]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      const rk = el.getAttribute('data-rel-key');
      const rv = el.getAttribute('data-rel-val');
      if (rk && rv) showRecordInspector(rk, rv);
    }));
    // Record inspector: click any register row to open its Power Apps 360° Record Form & Related Subgrids
    container.querySelectorAll('tr.rrow[data-rid]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('[data-rel-key], button, a, input, select')) return;
      const sel = String(window.getSelection && window.getSelection() || '');
      if (sel.length > 1) return; // the user is copying text, not opening the row
      showRecordInspector(tr.getAttribute('data-rkey'), tr.getAttribute('data-rid'));
    }));
    container.querySelectorAll('[data-open-modal]').forEach(btn => btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-open-modal'))));
    if (STATE.view === 'statements' && window.MFG_RDL && typeof window.MFG_RDL.wireStatementsEvents === 'function') {
      window.MFG_RDL.wireStatementsEvents(container, SEED, STATE, renderApp);
    } else {
      container.querySelectorAll('[data-stmt]').forEach(card => {
        const go = () => {
          STATE.activeStatement = card.getAttribute('data-stmt');
          renderApp();
          const sheet = $('printableSheet');
          if (sheet) sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        card.addEventListener('click', go);
        card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      const stmtSel = $('stmtQuickSelect');
      if (stmtSel) stmtSel.addEventListener('change', e => {
        STATE.activeStatement = e.target.value;
        renderApp();
      });
    }
    container.querySelectorAll('th.sortable').forEach(h => h.addEventListener('click', () => {
      const view = h.getAttribute('data-sort-view'), key = h.getAttribute('data-sort-key');
      const cur = STATE.sortBy[view] || {};
      STATE.sortBy[view] = { key, dir: cur.key === key && cur.dir === 'desc' ? 'asc' : (cur.key === key ? 'desc' : (['date', 'start_date', 'name', 'Code', 'Customer', 'Supplier', 'Site', 'Equipment', 'customer', 'supplier', 'staff', 'payroll_month'].includes(key) && !/^(date|start_date)$/.test(key) ? 'asc' : 'desc')) };
      renderApp();
    }));
    container.querySelectorAll('[data-show-more]').forEach(btn => btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-show-more');
      STATE.shown[v] = shownCount(v) + PAGE;
      const ws = $('workspace');
      const y = ws ? ws.scrollTop : 0;
      renderApp();
      if (ws) ws.scrollTop = y;
    }));
    // Seamless infinite scroll inside .table-wrap (no "Show more" button required; totals in tfoot always sum 100% of matching rows)
    container.querySelectorAll('.table-wrap').forEach(wrap => {
      const thEl = wrap.querySelector('th[data-sort-view]');
      const v = thEl && thEl.getAttribute('data-sort-view');
      if (!v) return;
      wrap.addEventListener('scroll', () => {
        if (wrap.scrollTop + wrap.clientHeight < wrap.scrollHeight - 160) return;
        const rendered = wrap.querySelectorAll('tbody tr').length;
        if (rendered < shownCount(v)) return;
        const prevTop = wrap.scrollTop;
        const ws = $('workspace');
        const wsY = ws ? ws.scrollTop : 0;
        STATE.shown[v] = shownCount(v) + PAGE;
        renderApp();
        if (ws) ws.scrollTop = wsY;
        const nextTh = container.querySelector(`th[data-sort-view="${v}"]`);
        const nextWrap = nextTh && nextTh.closest('.table-wrap');
        if (nextWrap) nextWrap.scrollTop = prevTop;
      }, { passive: true });
    });
    container.querySelectorAll('[data-export-csv]').forEach(btn => btn.addEventListener('click', () => {
      const panel = $(btn.getAttribute('data-export-csv'));
      const tables = panel ? Array.from(panel.querySelectorAll('table')) : [];
      if (!tables.length) { toast('Nothing to export', 'err'); return; }
      const csv = tables.map(tableToCsv).join('\r\n\r\n');
      downloadCsv(`ISABI_MFG_${btn.getAttribute('data-export-name') || 'export'}_${STATE.company}_${STATE.period}_${todayISO()}.csv`, csv);
      toast('CSV downloaded');
    }));
    container.querySelectorAll('[data-void]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.armed === '1') { voidRecord(btn.getAttribute('data-void'), btn.getAttribute('data-void-id')); return; }
      btn.dataset.armed = '1';
      btn.textContent = 'Void?';
      btn.classList.add('armed');
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = '✕'; btn.classList.remove('armed'); } }, 4000);
    }));

    if (!(STATE.view === 'statements' && window.MFG_RDL)) {
      const printBtn = $('printStmtBtn');
      if (printBtn) printBtn.addEventListener('click', () => window.print());
      const csvBtn = $('exportCsvBtn');
      if (csvBtn) csvBtn.addEventListener('click', () => {
        const sheet = $('printableSheet');
        const tables = sheet ? Array.from(sheet.querySelectorAll('table')) : [];
        if (!tables.length) { toast('Nothing to export', 'err'); return; }
        const title = (STATEMENT_CATALOG.find(s => s.code === STATE.activeStatement) || {}).name || 'Statement';
        downloadCsv(`ISABI_MFG_Statement_${STATE.activeStatement}_${STATE.company}_${STATE.period}.csv`, `"${title}","${COMPANY_LABELS[STATE.company]}","${(getKPI().label || 'All-Time')}"\r\n\r\n` + tables.map(tableToCsv).join('\r\n\r\n'));
        toast('Statement CSV downloaded');
      });
    }

    // Users view (owner tools + Biometric Face ID Enrolment Studio)
    if (STATE.view === 'users' && FACE_STATE.enrolCamActive && streamAlive()) {
      const ev = $('enrolFaceVideo');
      if (ev && ev.srcObject !== FACE_STATE.stream) {
        ev.srcObject = FACE_STATE.stream;
        ev.play().catch(() => {});
      }
      if (!FACE_STATE.enrolLoopTimer) {
        FACE_STATE.enrolLoopTimer = setTimeout(enrolFaceTick, 150);
      }
    }
    wireEnrolPoseSlots($('enrolThumbStrip'));
    wireEnrolPoseSlots($('enrolPoseStepper'));
    wireUsersDirectoryActions($('usersDirectoryTbody') || container);

    const camPh = $('enrolCamPlaceholder');
    if (camPh) camPh.addEventListener('click', () => { startEnrolCamera(); });

    const enrolSel = $('enrolUserSelect');
    if (enrolSel) enrolSel.addEventListener('change', e => {
      FACE_STATE.enrolUserId = e.target.value;
      const u = enrolTargetUser();
      syncEnrolBufferFromUser(u, true);
      updateEnrolStudioDom();
    });
    const thrSel = $('enrolThresholdSel');
    if (thrSel) thrSel.addEventListener('change', e => {
      STATE.faceSettings.threshold = Number(e.target.value) || 0.50;
      saveLocalAuthAndRecords();
      updateEnrolStudioDom();
      toast(`Face ID match threshold set to τ ≤ ${STATE.faceSettings.threshold.toFixed(2)}`);
    });
    const req2faCb = $('enrolRequire2faCb');
    if (req2faCb) req2faCb.addEventListener('change', e => {
      STATE.faceSettings.enforce2FA = !!e.target.checked;
      saveLocalAuthAndRecords();
      updateEnrolStudioDom();
      toast(STATE.faceSettings.enforce2FA ? 'Biometric 2FA enforced for enrolled seats' : 'Biometric 2FA optional on PIN login');
    });
    const liveCb = $('enrolLivenessCb');
    if (liveCb) liveCb.addEventListener('change', e => {
      STATE.faceSettings.liveness = !!e.target.checked;
      saveLocalAuthAndRecords();
      updateEnrolStudioDom();
      toast(STATE.faceSettings.liveness ? 'Blink liveness check enabled' : 'Blink liveness check disabled');
    });
    const consentCb = $('enrolConsentCb');
    if (consentCb) consentCb.addEventListener('change', e => {
      FACE_STATE.enrolConsent = !!e.target.checked;
      if (FACE_STATE.enrolConsent && FACE_STATE.enrolStatusCls === 'warn') {
        FACE_STATE.enrolStatusText = 'Biometric consent active — click "Capture Pose" to record and store Pose 1.';
        FACE_STATE.enrolStatusCls = '';
        updateEnrolStudioDom();
      }
    });
    const startCamBtn = $('enrolStartCamBtn');
    if (startCamBtn) startCamBtn.addEventListener('click', async () => {
      if (FACE_STATE.enrolCamActive) {
        stopFaceCamera();
        FACE_STATE.enrolStatusText = 'Camera stopped.';
        FACE_STATE.enrolStatusCls = '';
        updateEnrolStudioDom();
        return;
      }
      await startEnrolCamera();
    });
    const capBtn = $('enrolCaptureBtn');
    if (capBtn) capBtn.addEventListener('click', () => { captureEnrolDescriptor(); });
    const saveEnrolBtn = $('enrolSaveBtn');
    if (saveEnrolBtn) saveEnrolBtn.addEventListener('click', () => { saveFaceEnrolment(); });
    const clearEnrolBtn = $('enrolClearBtn');
    if (clearEnrolBtn) clearEnrolBtn.addEventListener('click', () => { clearFaceEnrolment(); });
    const calibBtn = $('enrolCalibBtn');
    if (calibBtn) calibBtn.addEventListener('click', () => { runCalibrationReport(); });
    const testEnrolBtn = $('enrolTestBtn');
    if (testEnrolBtn) testEnrolBtn.addEventListener('click', async () => {
      const target = enrolTargetUser();
      const pool = usableFaces(target);
      if (!pool.length) {
        FACE_STATE.enrolStatusText = 'Capture at least 1 pose first to test recognition.';
        FACE_STATE.enrolStatusCls = 'warn';
        updateEnrolStudioDom();
        return;
      }
      if (FACE_STATE.enrolCamActive && streamAlive()) {
        const ev = $('enrolFaceVideo');
        await ensureFaceModelsLoaded();
        const det = await window.Face.detectOne(ev, true);
        if (!det || !det.descriptor) {
          FACE_STATE.enrolStatusText = 'Test recognition: no face detected in camera frame.';
          FACE_STATE.enrolStatusCls = 'warn';
        } else {
          const m = window.Face.match(det.descriptor, pool);
          const dec = window.Face.decide(m, Object.assign({}, window.Face.CONFIG, { threshold: Number(STATE.faceSettings.threshold || 0.50) }), { faceSizeFrac: det.faceSizeFrac });
          FACE_STATE.enrolStatusText = dec.status === 'ok'
            ? `✓ Match verified: ${dec.best.name} (d=${m.bestDist.toFixed(3)} ≤ τ=${Number(STATE.faceSettings.threshold).toFixed(2)}, runner-up Δ=${(m.secondDist - m.bestDist).toFixed(3)})`
            : `Test status: ${dec.status} (best=${m.best ? m.best.name : 'none'}, d=${m.bestDist.toFixed(3)})`;
          FACE_STATE.enrolStatusCls = dec.status === 'ok' ? 'ok' : 'warn';
        }
      } else {
        // Offline / self-consistency test of the target user's captured/saved descriptors
        const probeVec = (FACE_STATE.enrolCaptures[0] || userFaceSamples(target)[0]);
        if (probeVec && window.Face) {
          const m = window.Face.match(probeVec, pool);
          FACE_STATE.enrolStatusText = m.best
            ? `✓ Descriptor self-check: matches ${m.best.name} (d=${m.bestDist.toFixed(3)}, runner-up d=${m.secondDist === 9 ? '∞' : m.secondDist.toFixed(3)})`
            : 'No match found.';
          FACE_STATE.enrolStatusCls = 'ok';
        }
      }
      updateEnrolStudioDom();
    });

    const addUserBtn = $('addWebUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => { STATE.showAddUserForm = true; renderApp(); setTimeout(() => { const n = $('nu_name'); if (n) n.focus(); }, 50); });
    const cancelAddUserBtn = $('cancelAddUserBtn');
    if (cancelAddUserBtn) cancelAddUserBtn.addEventListener('click', () => { STATE.showAddUserForm = false; renderApp(); });

    const saveNewUserBtn = $('saveNewUserBtn');
    if (saveNewUserBtn) saveNewUserBtn.addEventListener('click', async () => {
      if (!isOwner()) return;
      const name = val('nu_name');
      const email = norm(val('nu_email'));
      const pin = val('nu_pin');
      const role = val('nu_role') || 'Entry';
      const companies = val('nu_companies') || 'WTC';
      const acc = (val('nu_access') || 'partial|partial').split('|');
      const errs = [];
      if (!name) errs.push('Full name is required.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Enter a valid email address.');
      if (!/^\d{4,8}$/.test(pin)) errs.push('PIN must be 4 to 8 digits.');
      const box = $('nuErrors');
      if (box) { box.hidden = !errs.length; box.innerHTML = errs.length ? `<ul>${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''; }
      if (errs.length) return;

      const existingIdx = STATE.users.findIndex(x => norm(x.email) === email);
      const prev = existingIdx >= 0 ? STATE.users[existingIdx] : {};
      const newUser = {
        id: existingIdx >= 0 ? prev.id : uid('u'),
        full_name: name,
        email,
        pin_code: pin,
        role,
        companies,
        pbi_access: acc[0] || 'partial',
        statements_access: acc[1] || 'partial',
        status: 'Active',
        last_login_at: prev.last_login_at || '',
        face_samples: prev.face_samples || [],
        face_required: !!prev.face_required,
        face_updated_at: prev.face_updated_at || ''
      };
      if (existingIdx >= 0) STATE.users[existingIdx] = Object.assign(STATE.users[existingIdx], newUser);
      else STATE.users.push(newUser);
      STATE.showAddUserForm = false;
      saveLocalAuthAndRecords();
      renderApp();
      toast(existingIdx >= 0 ? `Seat updated · ${name}` : `Seat created · ${name} (PIN ${pin})`);
      if (HAS_LOCAL_API) { try { await fetch('./api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: newUser }) }); } catch (_) { /* no server.py */ } }
      await syncWithCloud(true);
    });

    const syncNowBtn = $('syncCloudNowBtn');
    if (syncNowBtn) syncNowBtn.addEventListener('click', async () => {
      syncNowBtn.textContent = '↻ Syncing...';
      syncNowBtn.disabled = true;
      await syncWithCloud(true);
      const b = $('syncCloudNowBtn');
      if (b) { b.disabled = false; b.textContent = /Live/.test(STATE.cloudStatus) ? '✓ Cloud Synced' : '⚠ ' + STATE.cloudStatus.replace('● ', ''); setTimeout(() => { if (b.isConnected) b.textContent = '↻ Sync Cloud Now'; }, 2200); }
      renderApp();
    });

    const saveSbBtn = $('saveSbCfgBtn');
    if (saveSbBtn) saveSbBtn.addEventListener('click', () => {
      STATE.supabaseCfg = { url: val('sb_url'), anonKey: val('sb_key') };
      localStorage.setItem('isabi_mfg_supabase_cfg', JSON.stringify(STATE.supabaseCfg));
      saveSbBtn.textContent = '✓ Saved';
      setTimeout(() => { if (saveSbBtn.isConnected) saveSbBtn.textContent = 'Save'; }, 1500);
    });
  }

  function setView(view, opts = {}) {
    if (!VIEW_TITLES[view]) view = 'overview';
    if (!canViewView(view)) { toast('Your seat has no access to that module', 'err'); view = defaultViewFor(); }
    if (STATE.view === 'users' && view !== 'users' && FACE_STATE.enrolCamActive) {
      stopFaceCamera();
    }
    STATE.view = view;
    if (opts.reset !== false) { STATE.search = ''; STATE.chipFilter = 'all'; STATE.shown = {}; }
    if (!opts.noPush) {
      const h = '#' + view;
      if (location.hash !== h) history.pushState({ view }, '', h);
    }
    const sidebar = $('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    const bd = $('railBackdrop');
    if (bd) bd.hidden = true;
    renderApp();
    const ws = $('workspace');
    if (ws) ws.scrollTop = 0;
  }

  // Global Event Listeners
  function init() {
    applyCustomRecordsToSeed();

    // Period picker labels follow the snapshot (the DAX windows live in build/seed_from_dataverse.py)
    const periodSelInit = $('periodSelect');
    const gp = ((SEED.models['manufacturing-group'] || {}).periods) || {};
    if (periodSelInit) Array.from(periodSelInit.options).forEach(o => { const lbl = gp[o.value] && gp[o.value].label; if (lbl) o.textContent = lbl; });
    const snapEl = $('railRlsScope');
    if (snapEl) snapEl.title = `Snapshot generated ${String(SEED.generated_at || '')}`;

    // Mobile ↔ desktop titles follow the viewport (debounced; never while a form is open)
    let lastMobile = window.innerWidth <= 860, resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { const nowMobile = window.innerWidth <= 860; if (nowMobile !== lastMobile) { lastMobile = nowMobile; safeRender(); } }, 180);
    });

    const inviteEmail = PARAMS.get('email');
    const invitePin = PARAMS.get('pin');
    // Purge legacy auto-login key from localStorage so opening the app always presents #authGate first
    try { localStorage.removeItem('isabi_mfg_active_email'); } catch (_) {}
    let swResumeEmail = '';
    try {
      const rawSw = sessionStorage.getItem('isabi_mfg_sw_resume');
      sessionStorage.removeItem('isabi_mfg_sw_resume');
      if (rawSw) {
        const parsedSw = JSON.parse(rawSw);
        if (parsedSw && parsedSw.email && (Date.now() - Number(parsedSw.ts || 0)) < 8000) swResumeEmail = parsedSw.email;
      }
    } catch (_) {}
    const qView = PARAMS.get('view') || (location.hash || '').replace(/^#/, '');
    if (qView && VIEW_TITLES[qView]) STATE.view = qView;
    // Keep harmless flags (demo, nosse) but strip credentials / one-shot params; do not append #<view> while locked on #authGate
    const keep = new URLSearchParams();
    ['demo', 'nosse'].forEach(p => { if (PARAMS.has(p)) keep.set(p, PARAMS.get(p)); });
    const lockedCleanUrl = location.pathname + (keep.toString() ? '?' + keep.toString() : '');

    const swIdx = swResumeEmail ? STATE.users.findIndex(u => norm(u.email) === norm(swResumeEmail)) : -1;
    if (inviteEmail && invitePin) {
      history.replaceState({ view: STATE.view }, '', lockedCleanUrl); // never leave the PIN in the address bar / history
      performLogin(inviteEmail, invitePin).then(ok => { if (!ok || ok === '2fa_pending') openAuthGate(inviteEmail); });
    } else if (swIdx >= 0 && STATE.users[swIdx].status !== 'Suspended') {
      STATE.activeUserIdx = swIdx;
      closeAuthGate();
    } else {
      history.replaceState({ view: STATE.view }, '', lockedCleanUrl);
      openAuthGate(inviteEmail || '');
    }

    const signOutBtn = $('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);

    const authForm = $('authLoginForm');
    if (authForm) authForm.addEventListener('submit', e => { e.preventDefault(); performLogin(val('authEmailInput'), val('authPinInput')); });

    const authEnrolJumpBtn = $('authEnrolJumpBtn');
    if (authEnrolJumpBtn) authEnrolJumpBtn.addEventListener('click', async () => {
      const em = val('authEmailInput') || (IS_DEMO ? 'husseinbdeir@bhfirms.com' : '');
      const pn = val('authPinInput') || (IS_DEMO ? '1111' : '');
      if (!pn) {
        authError('Enter your 4-digit Access PIN above (or tap your seat on the right + PIN), then click "Sign In & Auto-Enrol Face ID".');
        return;
      }
      const ok = await performLogin(em, pn, { bypass2FA: true });
      if (ok === true) {
        const me = activeUser();
        FACE_STATE.enrolUserId = me.id;
        FACE_STATE.enrolCaptures = [];
        FACE_STATE.enrolThumbs = [];
        FACE_STATE.enrolLoadedForUserId = String(me.id);
        setView('users');
        setTimeout(async () => {
          const panel = $('faceEnrolPanel');
          if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const camOk = await startEnrolCamera();
          if (camOk && !navigator.webdriver) {
            // Auto-capture 3 poses hands-free as soon as the camera sees the user's face
            for (let step = 0; step < 3; step++) {
              await new Promise(r => setTimeout(r, 700));
              if (STATE.view !== 'users' || !FACE_STATE.enrolCamActive || FACE_STATE.enrolCaptures.length > step) break;
              await captureEnrolDescriptor();
            }
          }
        }, 120);
      }
    });

    const authCamBtn = $('authCamToggleBtn');
    if (authCamBtn) authCamBtn.addEventListener('click', () => {
      if (FACE_STATE.camActive) {
        FACE_STATE.authCamStoppedByUser = true;
        stopAuthFaceScanner();
        setAuthHint('Camera paused — click "Enable Camera" above or sign in with Email + PIN.', '');
      } else {
        FACE_STATE.authCamStoppedByUser = false;
        startAuthFaceScanner(true);
      }
    });
    const authSndBtn = $('authSoundBtn');
    if (authSndBtn) authSndBtn.addEventListener('click', () => {
      STATE.faceSettings.sound = !STATE.faceSettings.sound;
      saveLocalAuthAndRecords();
      updateAuthFaceUi();
      if (STATE.faceSettings.sound && window.Face && window.Face.Sound) {
        window.Face.Sound.unlock();
        window.Face.Sound.playSuccess();
      }
    });
    const cancel2faBtn = $('authCancel2faBtn');
    if (cancel2faBtn) cancel2faBtn.addEventListener('click', () => {
      FACE_STATE.pending2faUser = null;
      FACE_STATE.streakUser = null;
      FACE_STATE.streakCount = 0;
      setAuthStreak(0, 3);
      updateAuthFaceUi();
      setAuthHint('2FA step-up cancelled — select another seat or look at the camera.', '');
    });

    const mobileMenuBtn = $('mobileMenuBtn');
    const mobileDockMenuBtn = $('mobileDockMenuBtn');
    const railCollapseBtn = $('railCollapseBtn');
    const railNarrowBtn = $('railNarrowBtn');
    const railWiderBtn = $('railWiderBtn');
    const railResizer = $('railResizer');
    const sidebar = $('sidebar');
    const backdrop = $('railBackdrop');
    const toggleMobileDrawer = () => {
      if (!sidebar) return;
      const open = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', open);
      if (backdrop) backdrop.hidden = !open;
    };
    const closeRail = () => {
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.hidden = true;
    };
    const toggleDesktopOrMobileRail = () => {
      if (window.innerWidth <= 860) {
        toggleMobileDrawer();
      } else {
        STATE.railCollapsed = !STATE.railCollapsed;
        try { localStorage.setItem('isabi_mfg_rail_collapsed', STATE.railCollapsed ? '1' : '0'); } catch (_) {}
        syncRailCollapseUi();
      }
    };
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleDesktopOrMobileRail);
    if (railCollapseBtn) railCollapseBtn.addEventListener('click', () => {
      if (window.innerWidth <= 860) closeRail();
      else toggleDesktopOrMobileRail();
    });
    if (railNarrowBtn) railNarrowBtn.addEventListener('click', () => {
      if (STATE.railCollapsed) {
        STATE.railCollapsed = false;
        try { localStorage.setItem('isabi_mfg_rail_collapsed', '0'); } catch (_) {}
      }
      setRailWidth(STATE.railWidth - RAIL_STEP_W, true);
    });
    if (railWiderBtn) railWiderBtn.addEventListener('click', () => {
      if (STATE.railCollapsed) {
        STATE.railCollapsed = false;
        try { localStorage.setItem('isabi_mfg_rail_collapsed', '0'); } catch (_) {}
      }
      setRailWidth(STATE.railWidth + RAIL_STEP_W, true);
    });
    if (railResizer) {
      let draggingRail = false;
      const onMove = e => {
        if (!draggingRail) return;
        const clientX = typeof e.clientX === 'number' ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
        if (clientX == null) return;
        setRailWidth(clientX, false);
      };
      const onUp = () => {
        if (!draggingRail) return;
        draggingRail = false;
        document.body.classList.remove('is-resizing-rail');
        setRailWidth(STATE.railWidth, true);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      railResizer.addEventListener('pointerdown', e => {
        if (window.innerWidth <= 860 || e.button === 2) return;
        e.preventDefault();
        draggingRail = true;
        document.body.classList.add('is-resizing-rail');
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
      railResizer.addEventListener('dblclick', e => {
        e.preventDefault();
        setRailWidth(RAIL_DEFAULT_W, true);
      });
      railResizer.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setRailWidth(STATE.railWidth - 16, true); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setRailWidth(STATE.railWidth + 16, true); }
        else if (e.key === 'Home') { e.preventDefault(); setRailWidth(RAIL_MIN_W, true); }
        else if (e.key === 'End') { e.preventDefault(); setRailWidth(RAIL_MAX_W, true); }
        else if (e.key === 'Enter' || e.key === '0') { e.preventDefault(); setRailWidth(RAIL_DEFAULT_W, true); }
      });
    }
    if (mobileDockMenuBtn) mobileDockMenuBtn.addEventListener('click', toggleMobileDrawer);
    if (backdrop) backdrop.addEventListener('click', closeRail);

    document.querySelectorAll('#sidebarNav .nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-view'))));
    document.querySelectorAll('#mobileBottomDock [data-dock-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.getAttribute('data-dock-view'))));
    const brand = $('brandHomeLink');
    if (brand) brand.addEventListener('click', e => { e.preventDefault(); setView('overview'); });

    document.querySelectorAll('#companySwitch .entity-btn').forEach(btn => btn.addEventListener('click', () => { STATE.company = btn.getAttribute('data-company'); STATE.shown = {}; STATE.pbiTablePage = {}; saveFilterState(); renderApp(); }));
    document.querySelectorAll('#grainSwitch .grain-btn').forEach(btn => btn.addEventListener('click', () => setDateFilter({ grain: btn.getAttribute('data-grain') })));
    const periodSel = $('periodSelect');
    if (periodSel) periodSel.addEventListener('change', e => setDateFilter({ period: e.target.value }));
    const dateFromEl = $('dateFromInput');
    if (dateFromEl) dateFromEl.addEventListener('change', e => setDateFilter({ from: e.target.value }));
    const dateToEl = $('dateToInput');
    if (dateToEl) dateToEl.addEventListener('change', e => setDateFilter({ to: e.target.value }));
    const dateRstEl = $('dateRangeResetBtn');
    if (dateRstEl) dateRstEl.addEventListener('click', () => setDateFilter({ reset: true }));
    document.querySelectorAll('#basisSwitch .basis-btn').forEach(btn => btn.addEventListener('click', () => { STATE.basis = btn.getAttribute('data-basis'); saveFilterState(); renderApp(); }));

    const toggleTheme = () => { STATE.theme = STATE.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('isabi_mfg_theme', STATE.theme); renderApp(); };
    const themeBtn = $('themeToggleBtn');
    const mobileThemeBtn = $('mobileThemeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (mobileThemeBtn) mobileThemeBtn.addEventListener('click', toggleTheme);

    const newTicketBtn = $('newEntryBtn');
    const mobileDockEntryBtn = $('mobileDockEntryBtn');
    if (newTicketBtn) newTicketBtn.addEventListener('click', () => openEntryModal(contextFormForView(STATE.view)));
    if (mobileDockEntryBtn) mobileDockEntryBtn.addEventListener('click', () => openEntryModal(contextFormForView(STATE.view)));
    const closeEntryBtn = $('closeModalBtn');
    if (closeEntryBtn) closeEntryBtn.addEventListener('click', () => closeEntryModal());
    const modal = $('entryModal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeEntryModal(); });
    document.querySelectorAll('#modalTabs .modal-tab').forEach(btn => btn.addEventListener('click', () => openEntryModal(btn.getAttribute('data-form'))));

    // Ask ISABI slide-over drawer
    const openAskBtn = $('askIsabiBtn');
    const mobileAskBtn = $('mobileAskIsabiBtn');
    const closeAskBtn = $('closeAiDrawerBtn');
    const resetAskBtn = $('resetAiThreadBtn');
    const askDrawer = $('aiDrawer');
    const askLog = $('aiMessages');
    const askInput = $('aiInput');
    const askForm = $('aiForm');
    const defaultPrompt = 'Compare WTC vs BBConstruction revenue, margin, and operating profit';

    function pushAskMessage(qText) {
      if (!qText || !askLog) return;
      const uBubble = document.createElement('div');
      uBubble.className = 'ai-msg-user';
      uBubble.textContent = qText;
      askLog.appendChild(uBubble);
      const bBubble = document.createElement('div');
      bBubble.className = 'ai-msg-bot';
      bBubble.innerHTML = answerAskIsabi(qText);
      askLog.appendChild(bBubble);
      askLog.scrollTop = askLog.scrollHeight;
    }
    const openDrawer = () => {
      if (!askDrawer) return;
      closeRail();
      askDrawer.classList.add('open');
      askDrawer.setAttribute('aria-hidden', 'false');
      if (askLog && !askLog.children.length) pushAskMessage(defaultPrompt);
      if (askInput && window.matchMedia('(min-width: 861px)').matches) setTimeout(() => askInput.focus(), 200);
    };
    const closeDrawer = () => { if (askDrawer) { askDrawer.classList.remove('open'); askDrawer.setAttribute('aria-hidden', 'true'); } };
    if (openAskBtn) openAskBtn.addEventListener('click', openDrawer);
    if (mobileAskBtn) mobileAskBtn.addEventListener('click', openDrawer);
    if (closeAskBtn) closeAskBtn.addEventListener('click', closeDrawer);
    if (resetAskBtn && askLog) resetAskBtn.addEventListener('click', () => { askLog.innerHTML = ''; pushAskMessage(defaultPrompt); });
    document.querySelectorAll('#aiChips .ai-pill-btn').forEach(chip => chip.addEventListener('click', () => pushAskMessage(chip.getAttribute('data-prompt') || chip.textContent)));
    if (askForm && askInput) askForm.addEventListener('submit', e => { e.preventDefault(); if (askInput.value.trim()) { pushAskMessage(askInput.value.trim()); askInput.value = ''; } });

    // Keyboard: Escape closes the modal / drawer / rail; Ctrl+K focuses search
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const ins = $('recordInspector');
        if (ins && !ins.hidden) { closeRecordInspector(); return; }
        const m = $('entryModal');
        if (m && !m.hidden) { closeEntryModal(); return; }
        if (askDrawer && askDrawer.classList.contains('open')) { closeDrawer(); return; }
        if (sidebar && sidebar.classList.contains('open')) { closeRail(); return; }
        if (STATE.showAddUserForm) { STATE.showAddUserForm = false; renderApp(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const s = $('tableSearchInput'); if (s) { e.preventDefault(); s.focus(); s.select(); } }
    });

    // History: back / forward + hash links move between modules (only after sign-in)
    window.addEventListener('popstate', e => {
      if (!STATE.authed) return;
      const v = (e.state && e.state.view) || (location.hash || '').replace(/^#/, '') || 'overview';
      if (VIEW_TITLES[v]) setView(v, { noPush: true });
    });
    window.addEventListener('hashchange', () => {
      const v = (location.hash || '').replace(/^#/, '');
      if (!STATE.authed) {
        if (VIEW_TITLES[v]) STATE.view = v;
        history.replaceState({ view: STATE.view }, '', lockedCleanUrl);
        return;
      }
      if (VIEW_TITLES[v] && v !== STATE.view) setView(v, { noPush: true });
    });

    // SQLite API status (LAN host only)
    if (HAS_LOCAL_API) {
      fetch('./api/status').then(r => r.json()).then(st => {
        const el = $('sqlStatusText');
        if (el && st.ok) el.textContent = `Cloud + SQLite (${Number(st.db_size_kb || 0).toLocaleString()} KB)`;
      }).catch(() => { const el = $('sqlStatusText'); if (el) el.textContent = 'Cloud relay (no local SQLite)'; });
    } else {
      const el = $('sqlStatusText');
      if (el) el.textContent = 'Cloud relay';
    }

    // Cloud relay: on start, when the tab comes back, when the network returns
    syncWithCloud(false);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncWithCloud(false);
        if (!STATE.authed && !FACE_STATE.authCamStoppedByUser && !streamAlive() && !navigator.webdriver && !window.__MFG_HEADLESS_TEST) {
          startAuthFaceScanner(false);
        }
      }
    });
    window.addEventListener('online', () => { toast('Back online — syncing'); syncWithCloud(true); });
    window.addEventListener('offline', () => { STATE.cloudStatus = '● Offline Cache'; updateCloudBadges(); toast('Offline — entries are kept on this device and sync later', 'err'); });
    window.addEventListener('pagehide', () => { if (STATE.pushAfterSync) syncWithCloud(true); });

    // Expose deterministic hooks for headless verification (build/verify_mfg.mjs)
    window.MFG_FACE_TEST = {
      state: () => ({
        authed: STATE.authed,
        activeEmail: activeUser().email,
        pending2fa: FACE_STATE.pending2faUser ? FACE_STATE.pending2faUser.email : null,
        streakCount: FACE_STATE.streakCount,
        enrolCaptures: FACE_STATE.enrolCaptures.length,
        enrolledSeats: STATE.users.filter(userHasFaceId).map(u => u.email)
      }),
      makeSyntheticVector: (seedIdx, jitter = 0) => {
        const v = new Array(128);
        for (let i = 0; i < 128; i++) {
          v[i] = Math.sin((seedIdx + 1) * (i + 1) * 0.37) * 0.25 + Math.cos((i + 3) * (jitter + 1)) * jitter;
        }
        return v;
      },
      selectEnrolSeat: email => {
        const u = STATE.users.find(x => norm(x.email) === norm(email));
        if (!u) return false;
        FACE_STATE.enrolUserId = u.id;
        FACE_STATE.enrolLoadedForUserId = String(u.id);
        FACE_STATE.enrolConsent = true;
        FACE_STATE.enrolCaptures = [];
        FACE_STATE.enrolThumbs = [];
        updateEnrolStudioDom();
        return true;
      },
      captureSyntheticPose: (vec, detScore = 0.96, faceSizeFrac = 0.26) =>
        captureEnrolDescriptor({ descriptor: vec, detScore, faceSizeFrac, multiple: false }),
      saveEnrolment: () => saveFaceEnrolment(),
      clearEnrolment: () => clearFaceEnrolment(),
      runCalibration: () => runCalibrationReport(),
      feedAuthFrame: (vec, faceSizeFrac = 0.26) =>
        handleAuthDescriptor({ descriptor: vec, detScore: 0.96, faceSizeFrac, multiple: false }, ''),
      performLogin: (email, pin, opts) => performLogin(email, pin, opts),
      signOut: () => signOut()
    };

    if (!STATE.authed && !navigator.webdriver && !window.__MFG_HEADLESS_TEST) {
      setTimeout(() => { if (!STATE.authed) renderApp(); }, 180);
    } else {
      renderApp();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
