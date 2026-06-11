/* ============================================================
   벨로르(BELLORE) · 검색 페이지 (GUGUS 스타일)
   ------------------------------------------------------------
   - 헤더 검색 → 전체화면 검색 페이지로 이동
   - 탭: 검색어 / 카테고리 / 오늘시세
   - 검색어: 최근검색어(계정·게스트별) / 추천검색어(3시간 회전)
            / 인기검색어(검색기록 1000건 미만이면 핫 브랜드) / 최근 확인한 상품(20개)
   - 카테고리: 좌측 브랜드 → 우측 모델 → 클릭 시 판매시계로 이동
   - 오늘시세: 시세 그래프(준비중 · 데이터 적립용 테스트 표시)
   ============================================================ */
(function () {
  'use strict';
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  var BRANDS = window.BELLORE_BRANDS || [];

  /* ---------- 계정 키(최근검색어/최근본상품 분리) ---------- */
  function uid() {
    try { var u = window.NWBackend && NWBackend.currentUser && NWBackend.currentUser(); if (u && u.uid) return u.uid; } catch (e) {}
    return 'guest';
  }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function recentKey() { return 'bellore_recent_kw_' + uid(); }
  var VIEWED_KEY = 'bellore_recent_items';

  function getRecent() { return lsGet(recentKey()); }
  function addRecent(q) {
    q = String(q || '').trim(); if (!q) return;
    var arr = getRecent().filter(function (x) { return x !== q; });
    arr.unshift(q); arr = arr.slice(0, 12);
    lsSet(recentKey(), arr);
  }
  function removeRecent(q) { lsSet(recentKey(), getRecent().filter(function (x) { return x !== q; })); }
  function clearRecent() { lsSet(recentKey(), []); }

  /* ---------- 최근 확인한 상품 ---------- */
  window.BELLORE_recordView = function (it) {
    if (!it || (!it.brand && !it.model)) return;
    var id = String(it.id || (it.brand + '|' + it.model));
    var arr = lsGet(VIEWED_KEY).filter(function (x) { return String(x.id) !== id; });
    arr.unshift({ id: id, brand: it.brand || '', model: it.model || '', price: it.price || 0, sale_price: it.sale_price || 0, img: it.img || it.image || '' });
    lsSet(VIEWED_KEY, arr.slice(0, 20));
  };
  function getViewed() { return lsGet(VIEWED_KEY); }

  /* ---------- 추천 검색어(3시간마다 회전) ---------- */
  var SUGGEST_POOL = [
    '스피드마스터 문워치', '엠워치', '보테가베네타 가방', '로얄오크', '노틸러스', '데이토나',
    '서브마리너', 'GMT마스터', '까르띠에 산토스', '오메가 씨마스터', '리차드밀', '파텍필립 아쿠아넛',
    '예거 르쿨트르 리베르소', '블랙베이', '카레라', '빅뱅', '네비타이머', '루미노르',
    '랑에1', '오버시즈', '벤츄라', 'J12', '캡틴쿡', 'PRX'
  ];
  function suggestNow() {
    // 3시간 단위 시드로 풀에서 6개 회전
    var slot = Math.floor(Date.now() / (3 * 3600 * 1000));
    var out = [], n = SUGGEST_POOL.length, start = slot % n;
    for (var i = 0; i < 6; i++) out.push(SUGGEST_POOL[(start + i) % n]);
    return out;
  }

  /* ---------- 인기 검색어(핫 브랜드 폴백) ---------- */
  var HOT_BRANDS = ['롤렉스', '파텍필립', '오메가', '까르띠에', '오데마피게', '튜더', '위블로', '태그호이어', 'IWC', '브라이틀링'];
  function popularNow(cb) {
    // 검색기록 1000건 이상이면 실제 랭킹, 아니면 핫 브랜드
    if (window.NWBackend && NWBackend.popularSearches) {
      NWBackend.popularSearches(10).then(function (rows) {
        if (rows && rows.total >= 1000 && rows.list && rows.list.length) cb(rows.list.map(function (r) { return r.q; }));
        else cb(HOT_BRANDS);
      }).catch(function () { cb(HOT_BRANDS); });
    } else cb(HOT_BRANDS);
  }

  /* ---------- 검색 실행 ---------- */
  function runQuery(q) {
    q = String(q || '').trim(); if (!q) return;
    addRecent(q);
    if (window.NWBackend && NWBackend.logSearch) { try { NWBackend.logSearch(q); } catch (e) {} }
    closePage();
    if (window.BELLORE_runSearch) window.BELLORE_runSearch(q);
  }

  /* ---------- 페이지 셸 ---------- */
  var page = document.createElement('div');
  page.className = 'search-page'; page.id = 'searchPage'; page.hidden = true;
  page.innerHTML =
    '<header class="sp-top">' +
      '<form class="sp-bar" id="spForm">' +
        '<svg class="sp-bar-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
        '<input type="search" id="spInput" placeholder="검색어를 입력해 주세요." autocomplete="off" enterkeyhint="search">' +
      '</form>' +
      '<button type="button" class="sp-close" data-spclose aria-label="닫기">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
    '</header>' +
    '<nav class="sp-tabs">' +
      '<button type="button" class="sp-tab active" data-sptab="word">검색어</button>' +
      '<button type="button" class="sp-tab" data-sptab="cat">카테고리</button>' +
      '<button type="button" class="sp-tab" data-sptab="price">오늘시세</button>' +
    '</nav>' +
    '<div class="sp-scroll">' +
      '<section class="sp-panel" data-sppanel="word"></section>' +
      '<section class="sp-panel" data-sppanel="cat" hidden></section>' +
      '<section class="sp-panel" data-sppanel="price" hidden></section>' +
    '</div>';
  document.body.appendChild(page);

  var input = $('#spInput', page);

  function openPage(tab) {
    page.hidden = false;
    document.body.style.overflow = 'hidden';
    switchTab(tab || 'word');
    setTimeout(function () { if ((tab || 'word') === 'word') input.focus(); }, 50);
  }
  function closePage() { page.hidden = true; document.body.style.overflow = ''; if (input) input.value = ''; }
  window.BELLORE_openSearch = openPage;

  function switchTab(t) {
    $$('.sp-tab', page).forEach(function (x) { x.classList.toggle('active', x.dataset.sptab === t); });
    $$('.sp-panel', page).forEach(function (p) { p.hidden = p.dataset.sppanel !== t; });
    $('.sp-scroll', page).scrollTop = 0;
    if (t === 'word') renderWord();
    else if (t === 'cat') renderCat();
    else renderPrice();
  }

  /* ---------- 검색어 탭 ---------- */
  function renderWord() {
    var el = $('.sp-panel[data-sppanel="word"]', page);
    var recent = getRecent();
    var recentHTML = recent.length
      ? recent.map(function (q) {
          return '<button type="button" class="sp-chip" data-q="' + esc(q) + '">' + esc(q) +
            '<span class="sp-chip-x" data-rmq="' + esc(q) + '">×</span></button>';
        }).join('')
      : '<p class="sp-empty">최근 검색어가 없습니다.</p>';

    var suggest = suggestNow().map(function (q) {
      return '<button type="button" class="sp-sug" data-q="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('');

    var viewed = getViewed();
    var viewedHTML = viewed.length
      ? '<div class="sp-viewed-row">' + viewed.map(function (it) {
          var price = it.sale_price && it.sale_price < it.price ? it.sale_price : it.price;
          return '<button type="button" class="sp-viewed" data-pid="' + esc(it.id) + '" data-brand="' + esc(it.brand) + '" data-model="' + esc(it.model) + '" data-price="' + (it.price || 0) + '" data-sprice="' + (it.sale_price || '') + '">' +
            '<span class="sp-viewed-img"><img src="' + esc(it.img || 'assets/images.jpg') + '" alt="" loading="lazy"></span>' +
            '<span class="sp-viewed-brand">' + esc(it.brand) + '</span>' +
            '<span class="sp-viewed-price">' + (price ? fmt(price) + '원' : '문의') + '</span>' +
          '</button>';
        }).join('') + '</div>'
      : '<p class="sp-empty">최근 확인한 상품이 없습니다.</p>';

    el.innerHTML =
      '<div class="sp-sec">' +
        '<div class="sp-sec-head"><h3>최근 검색어</h3>' + (recent.length ? '<button type="button" class="sp-clear" data-clearrecent>전체삭제</button>' : '') + '</div>' +
        '<div class="sp-chips">' + recentHTML + '</div>' +
      '</div>' +
      '<div class="sp-sec">' +
        '<div class="sp-sec-head"><h3>추천 검색어</h3></div>' +
        '<div class="sp-sugs">' + suggest + '</div>' +
      '</div>' +
      '<div class="sp-sec">' +
        '<div class="sp-sec-head"><h3>인기 검색어</h3><span class="sp-pop-note" id="spPopNote"></span></div>' +
        '<ol class="sp-pop" id="spPop"></ol>' +
      '</div>' +
      '<div class="sp-sec">' +
        '<div class="sp-sec-head"><h3>최근 확인한 상품</h3></div>' +
        viewedHTML +
      '</div>';

    popularNow(function (list) {
      var ol = $('#spPop', page); if (!ol) return;
      ol.innerHTML = list.slice(0, 10).map(function (q, i) {
        return '<li><button type="button" class="sp-pop-item" data-q="' + esc(q) + '"><b>' + (i + 1) + '</b><span>' + esc(q) + '</span></button></li>';
      }).join('');
    });
  }

  /* ---------- 카테고리 탭 (브랜드 → 모델) ---------- */
  var catBrandIdx = 0;
  function renderCat() {
    var el = $('.sp-panel[data-sppanel="cat"]', page);
    var left = BRANDS.map(function (b, i) {
      return '<button type="button" class="sp-brand' + (i === catBrandIdx ? ' on' : '') + '" data-bi="' + i + '">' + esc(b.name) + '</button>';
    }).join('');
    el.innerHTML =
      '<div class="sp-cat">' +
        '<div class="sp-cat-left">' + left + '</div>' +
        '<div class="sp-cat-right" id="spModels"></div>' +
      '</div>';
    renderModels();
  }
  function renderModels() {
    var box = $('#spModels', page); if (!box) return;
    var b = BRANDS[catBrandIdx]; if (!b) return;
    box.innerHTML =
      '<button type="button" class="sp-model sp-model-all" data-brand="' + esc(b.name) + '" data-model="">' +
        '<img class="sp-model-logo" src="' + window.BELLORE_BRAND_LOGO(b.slug) + '" alt=""><b>' + esc(b.name) + ' 전체</b></button>' +
      b.models.map(function (m) {
        return '<button type="button" class="sp-model" data-brand="' + esc(b.name) + '" data-model="' + esc(m) + '">' + esc(m) + '</button>';
      }).join('');
  }

  /* ---------- 오늘시세 탭 (준비중) ---------- */
  function renderPrice() {
    var el = $('.sp-panel[data-sppanel="price"]', page);
    el.innerHTML =
      '<div class="sp-price-head"><h3>오늘의 시세</h3><span class="sp-price-test">TEST · 데이터 적립중</span></div>' +
      '<p class="sp-price-desc">모든 시계의 시세를 그래프로 확인하는 기능을 준비하고 있습니다. 거래·검색 데이터가 쌓이면 브랜드·모델별 시세 추이를 제공합니다.</p>' +
      '<div class="sp-price-list">' +
        BRANDS.map(function (b) {
          return '<button type="button" class="sp-price-row" data-bi-price="' + esc(b.name) + '">' +
            '<img src="' + window.BELLORE_BRAND_LOGO(b.slug) + '" alt=""><span>' + esc(b.name) + '</span>' +
            '<em class="sp-price-soon">준비중</em></button>';
        }).join('') +
      '</div>';
  }

  /* ---------- 이벤트 ---------- */
  page.addEventListener('submit', function (e) {
    if (e.target.id === 'spForm') { e.preventDefault(); runQuery(input.value); }
  });
  input.addEventListener('search', function () { runQuery(input.value); });
  page.addEventListener('click', function (e) {
    if (e.target.closest('[data-spclose]')) { closePage(); return; }
    var tab = e.target.closest('[data-sptab]'); if (tab) { switchTab(tab.dataset.sptab); return; }

    // 최근검색어 삭제
    var rm = e.target.closest('[data-rmq]'); if (rm) { e.stopPropagation(); removeRecent(rm.dataset.rmq); renderWord(); return; }
    if (e.target.closest('[data-clearrecent]')) { clearRecent(); renderWord(); return; }

    // 검색어/추천/인기 클릭 → 검색 실행
    var q = e.target.closest('[data-q]'); if (q) { runQuery(q.dataset.q); return; }

    // 최근 확인한 상품 → 상세
    var v = e.target.closest('.sp-viewed'); if (v) { openViewed(v); return; }

    // 카테고리 브랜드 선택
    var bi = e.target.closest('[data-bi]'); if (bi) { catBrandIdx = parseInt(bi.dataset.bi, 10) || 0; renderCat(); return; }

    // 모델 클릭 → 판매시계 이동
    var md = e.target.closest('.sp-model'); if (md) {
      var brand = md.dataset.brand, model = md.dataset.model;
      runQuery(model ? (brand + ' ' + model) : brand);
      return;
    }
    // 오늘시세 행(준비중)
    if (e.target.closest('[data-bi-price]')) { /* 준비중 — 동작 없음 */ return; }
  });

  function openViewed(v) {
    closePage();
    // 가상 카드를 만들어 기존 상세 로직 재사용
    var card = document.createElement('article');
    card.className = 'hcard'; card.dataset.pid = v.dataset.pid;
    card.dataset.brand = v.dataset.brand; card.dataset.model = v.dataset.model;
    card.dataset.price = v.dataset.price; card.dataset.sprice = v.dataset.sprice || '';
    card.innerHTML = '<div class="hcard-img"><img src="' + (v.querySelector('img') ? v.querySelector('img').src : '') + '"></div>' +
      '<p class="hcard-brand">' + esc(v.dataset.brand) + '</p><p class="hcard-model">' + esc(v.dataset.model) + '</p>';
    if (window.BELLORE_openProductCard) window.BELLORE_openProductCard(card);
  }

  /* ---------- 헤더 검색 → 페이지 오픈 ---------- */
  function wireHeader() {
    var hs = $('#headerSearch'), si = $('#searchInput');
    if (si) { si.setAttribute('readonly', 'readonly'); si.removeAttribute('enterkeyhint'); }
    function open(e) { if (e) { e.preventDefault(); } openPage('word'); }
    if (hs) hs.addEventListener('submit', open);
    if (si) { si.addEventListener('focus', open); si.addEventListener('click', open); }
    if (hs) { var ic = hs.querySelector('.header-search-ic'); if (ic) ic.addEventListener('click', open); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireHeader);
  else wireHeader();

  /* ---------- 홈 원형 브랜드 → 판매시계 필터 연동 ---------- */
  document.addEventListener('click', function (e) {
    var c = e.target.closest('#brandCircleRow .brand-circle[data-brandfilter]');
    if (!c) return;
    var bf = c.dataset.brandfilter;
    setTimeout(function () {
      var sel = '#collection .cat-brand';
      var btns = $$(sel), hit = null;
      btns.forEach(function (b) { if ((b.dataset.brand || '') === bf) hit = b; });
      if (!hit && bf === 'all') hit = $('#collection .cat-brand[data-brand="all"]');
      if (hit) hit.click();
    }, 80);
  });
})();
