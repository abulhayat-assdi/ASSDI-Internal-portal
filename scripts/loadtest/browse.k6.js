// k6 load test: signed-in students browsing the portal.
//
//   k6 run scripts/loadtest/browse.k6.js \
//     -e BASE_URL=https://mycourse.tasm-skill.asf.bd \
//     -e EMAIL=student@example.com -e PASSWORD='...' \
//     -e PEAK_VUS=200
//
// Run it against a staging copy or off-hours, never during a live class: it
// generates real traffic and real DB load. Use a dedicated test student
// account; the account's session is shared by every virtual user.
//
// What it measures: the steady state after login, i.e. the middleware auth
// check plus the API/page work behind it, which is what the auth and branding
// caches target. Login itself runs once in setup(), because the login route is
// deliberately slow (bcrypt) and rate limited, and a real class does not log
// in all at once with the same account.
//
// Env:
//   BASE_URL   required, must include the course subdomain
//   EMAIL / PASSWORD   required, a real student or teacher account
//   PEAK_VUS   default 100
//   HOLD       time at peak, default 2m
//   ENDPOINTS  comma-separated extra GET paths to include in each iteration
//
// To compare before/after a change, run this twice with identical env and
// compare http_req_duration p95 and http_req_failed.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const PEAK_VUS = Number(__ENV.PEAK_VUS) || 100;
const HOLD = __ENV.HOLD || '2m';
const EXTRA = (__ENV.ENDPOINTS || '').split(',').map((s) => s.trim()).filter(Boolean);

const PATHS = ['/api/auth/profile', '/student-dashboard', ...EXTRA];

export const options = {
    scenarios: {
        browse: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '1m', target: PEAK_VUS },
                { duration: HOLD, target: PEAK_VUS },
                { duration: '30s', target: 0 },
            ],
            gracefulRampDown: '15s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<1500'],
    },
};

export function setup() {
    if (!BASE_URL || !__ENV.EMAIL || !__ENV.PASSWORD) {
        throw new Error('BASE_URL, EMAIL and PASSWORD are required');
    }
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    if (res.status !== 200) {
        throw new Error(`login failed: ${res.status} ${res.body}`);
    }
    const cookie = res.cookies['__session'];
    if (!cookie || !cookie.length) throw new Error('login returned no __session cookie');
    return { session: cookie[0].value };
}

export default function (data) {
    const params = { headers: { Cookie: `__session=${data.session}` } };

    for (const path of PATHS) {
        const res = http.get(`${BASE_URL}${path}`, { ...params, tags: { name: path } });
        check(res, { [`${path} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
        sleep(0.5 + Math.random());
    }
}
