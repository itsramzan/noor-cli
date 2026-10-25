# NOOR CLI

**সময়ের মিলনে প্রশান্তি**

NOOR CLI হলো Termux ও যেকোনো Linux/macOS টার্মিনালের জন্য একটি রঙিন ইসলামিক ড্যাশবোর্ড। একটি কমান্ডেই আপনি দেখতে পাবেন:

- বর্তমান সময়, ইংরেজি তারিখ, সংশোধিত বাংলাদেশি বাংলা তারিখ ও হিজরি তারিখ
- আজকের নামাজের সময়সূচি (ফজর, সূর্যোদয়, যোহর, আসর, সূর্যাস্ত, মাগরিব, ইশা)
- পরবর্তী নামাজ, বর্তমান নামাজের ওয়াক্ত ও কাউন্টডাউন
- ঢাকা, বাংলাদেশ ও `Asia/Dhaka` এর নিরাপদ ডিফল্ট; অন্য শহর, দেশ, টাইমজোন, হিসাব পদ্ধতি ও মাযহাব সহজে বদলানো যায়
- বাংলা ও ইংরেজি ইন্টারফেস, ১২/২৪ ঘণ্টার ঘড়ি
- ইন্টারনেট বন্ধ থাকলেও তারিখ ও সময় দেখানো; নামাজের সময় বানিয়ে না দেখানো

নামাজের সময় ও হিজরি তারিখ [AlAdhan API](https://aladhan.com/prayer-times-api) থেকে আনা হয়। অ্যাপ্লিকেশনে কোনো নামাজের সময় হার্ডকোড করা নেই।

> হিজরি তারিখ স্থানীয় চাঁদ দেখার উপর নির্ভর করে। তাই আপনার এলাকার সাথে API-এর তারিখ এক দিন আগে বা পরে হতে পারে। প্রয়োজনে `noor config adjustment 1` বা `noor config adjustment -1` দিয়ে সমন্বয় করুন।

---

## সূচিপত্র

1. [চাহিদা](#চাহিদা)
2. [Termux-এ ইনস্টল](#termux-এ-ইনস্টল)
3. [সাধারণ ইনস্টল](#সাধারণ-ইনস্টল)
4. [ব্যবহার](#ব্যবহার)
5. [কনফিগারেশন](#কনফিগারেশন)
6. [নামাজের হিসাব পদ্ধতি](#নামাজের-হিসাব-পদ্ধতি)
7. [বাংলা ক্যালেন্ডার](#বাংলা-ক্যালেন্ডার)
8. [API, ক্যাশ ও অফলাইন আচরণ](#api-ক্যাশ-ও-অফলাইন-আচরণ)
9. [পরিবেশ ভেরিয়েবল](#পরিবেশ-ভেরিয়েবল)
10. [টেস্ট চালানো](#টেস্ট-চালানো)
11. [স্যাম্পল আউটপুট](#স্যাম্পল-আউটপুট)
12. [কনফিগ ব্যাকআপ ও পুনরুদ্ধার](#কনফিগ-ব্যাকআপ-ও-পুনরুদ্ধার)
13. [আনইনস্টল](#আনইনস্টল)
14. [সমস্যা সমাধান](#সমস্যা-সমাধান)
15. [প্রকল্পের গঠন](#প্রকল্পের-গঠন)
16. [লাইসেন্স](#লাইসেন্স)

---

## চাহিদা

- **Node.js 20 বা তার নতুন সংস্করণ** (ES Modules)
- ইন্টারনেট সংযোগ (প্রথমবার নামাজের সময় ও হিজরি তারিখ আনতে)
- Termux, Linux বা macOS টার্মিনাল

Node-এর সংস্করণ দেখুন:

```bash
node -v
```

Termux-এ Node.js 20+ না থাকলে প্রথমে প্যাকেজ হালনাগাদ করুন।

---

## Termux-এ ইনস্টল

### ১. প্রস্তুতি

```bash
pkg update && pkg upgrade -y
pkg install nodejs git unzip -y
termux-setup-storage
```

`termux-setup-storage` চালানোর পর ফোনের স্টোরেজ ব্যবহারের অনুমতি দিন।

### ২. প্রজেক্ট কপি করুন

ZIP ফাইল ব্যবহার করলে:

```bash
cd ~
unzip ~/storage/downloads/noor-cli.zip -d ~
cd ~/noor-cli
```

Git ব্যবহার করলে (প্রজেক্টটি যেখানে রাখা হয়েছে সেই রিপোজিটরি ঠিকানা বসান):

```bash
cd ~
git clone <repository-url> noor-cli
cd noor-cli
```

### ৩. ডিপেন্ডেন্সি ইনস্টল

```bash
npm install
```

### ৪. `noor` কমান্ড চালু করুন

```bash
npm link
```

এরপর যেকোনো ফোল্ডার থেকে:

```bash
noor
```

`npm link` কাজ না করলে সরাসরি চালাতে পারেন:

```bash
node ~/noor-cli/src/index.js
```

অথবা `~/.bashrc`-এ একটি শর্টকাট যোগ করুন:

```bash
echo "alias noor='node ~/noor-cli/src/index.js'" >> ~/.bashrc
source ~/.bashrc
```

### ৫. প্রথমবার চালান

```bash
noor
```

ড্যাশবোর্ড একবার দেখিয়ে প্রোগ্রামটি বন্ধ হয়ে যাবে। এটি কোনো ব্যাকগ্রাউন্ড সার্ভার বা লাইভ লুপ চালায় না।

---

## সাধারণ ইনস্টল

Node.js 20+ থাকলে যেকোনো Linux/macOS সিস্টেমে:

```bash
cd noor-cli
npm install
npm link          # অথবা: npm install -g .
noor
```

শুধু প্রজেক্ট ফোল্ডার থেকে চালাতে চাইলে `npm link` ছাড়াও কাজ করবে:

```bash
npm start
```

---

## ব্যবহার

```bash
noor                     # ডিফল্ট ড্যাশবোর্ড (একবার)
noor refresh             # API থেকে জোর করে নতুন তথ্য আনা
noor config              # কনফিগ দেখানো বা ইন্টারঅ্যাকটিভভাবে বদলানো
noor config <key> [value] # একটি সেটিং পড়া বা বদলানো
noor --help              # সাহায্য
noor --version           # সংস্করণ
```

### প্রদর্শনের অপশন

| অপশন | কাজ |
|---|---|
| `--bn` | শুধু এই চালানোর জন্য বাংলা ইন্টারফেস |
| `--en` | শুধু এই চালানোর জন্য ইংরেজি ইন্টারফেস |
| `--12h` | ১২ ঘণ্টার ঘড়ি (AM/PM) |
| `--24h` | ২৪ ঘণ্টার ঘড়ি |

উদাহরণ:

```bash
noor --bn --24h
noor --en --12h
```

>`--bn`, `--en`, `--12h`, `--24h` শুধু বর্তমান চালানোর জন্য প্রযোজ্য; এগুলো কনফিগ ফাইলে সংরক্ষিত হয় না।

### কমান্ডের আচরণ

- `noor` — একবার ড্যাশবোর্ড দেখিয়ে `0` কোডে বন্ধ হয়।
- `noor refresh` — ক্যাশ উপেক্ষা করে API থেকে নতুন তথ্য আনে। API ব্যর্থ হলে সর্বশেষ সফল ক্যাশ ব্যবহার করে এবং `CACHED` দেখায়।
- `noor config` — টার্মিনাল TTY হলে ধাপে ধাপে সেটিং জিজ্ঞাসা করে; অন্যথায় শুধু কনফিগ দেখায়।
- `noor config <key>` — কনফিগ ও সংশ্লিষ্ট অপশন দেখায়। `noor config method` পুরো হিসাব পদ্ধতির তালিকাও দেখায়।
- অজানা কমান্ড বা ভুল মানে `2` কোডে বন্ধ হয়; অনাকাঙ্ক্ষিত ত্রুটিতে `1`; অফলাইনেও ড্যাশবোর্ড দেখালে `0`।

---

## কনফিগারেশন

কনফিগ ফাইল:

```text
~/.config/noor-cli/config.json
```

`XDG_CONFIG_HOME` সেট থাকলে:

```text
$XDG_CONFIG_HOME/noor-cli/config.json
```

### ডিফল্ট মান

| কী | ডিফল্ট | বিবরণ |
|---|---|---|
| `city` | `Dhaka` | শহর |
| `country` | `Bangladesh` | দেশ |
| `timezone` | `Asia/Dhaka` | IANA টাইমজোন |
| `method` | `1` | AlAdhan হিসাব পদ্ধতি (Karachi) |
| `school` | `0` | আসর: `0` = শাফি (ডিফল্ট), `1` = হানাফি |
| `language` | `en` | `en` বা `bn` |
| `timeFormat` | `12h` | `12h` বা `24h` |
| `hijriAdjustment` | `0` | হিজরি তারিখ সমন্বয়: `-3` থেকে `+3` দিন |

### সেটিং বদলানো

```bash
noor config city Savar
noor config country Bangladesh
noor config timezone Asia/Dhaka
noor config method 1
noor config school 0
noor config language bn
noor config format 24h
noor config adjustment 0
```

উপনাম:

- `format` = `timeFormat`
- `adjustment` = `hijriAdjustment`

### ইন্টারঅ্যাকটিভ কনফিগ

```bash
noor config
```

প্রতিটি প্রশ্নে নতুন মান লিখে Enter দিন। বর্তমান মান রাখতে শুধু Enter দিন। সব প্রশ্ন শেষে কনফিগ পরমাণবিকভাবে (atomic write) সংরক্ষিত হয়। ফাইলটি `0600` অনুমতিতে রাখা হয়।

### টাইমজোন সম্পর্কে গুরুত্বপূর্ণ কথা

API শহর ও দেশ অনুযায়ী নামাজের সময় দেয়। NOOR CLI সেই সময়গুলো আপনার `timezone` অনুযায়ী দেখায়। তাই **শহর বদলালে টাইমজোনও বদলান**:

```bash
noor config city London
noor config country United Kingdom
noor config timezone Europe/London
```

ভুল টাইমজোন দিলে সময় ভুল দেখাবে। IANA নাম ব্যবহার করুন, যেমন `Asia/Dhaka`, `Asia/Kolkata`, `Europe/London`, `America/New_York`।

---

## নামাজের হিসাব পদ্ধতি

`noor config method` চালালে সম্পূর্ণ তালিকা দেখা যাবে। কিছু সাধারণ পদ্ধতি:

| ID | পদ্ধতি |
|---|---|
| `1` | University of Islamic Sciences, Karachi |
| `2` | Islamic Society of North America (ISNA) |
| `3` | Muslim World League |
| `4` | Umm Al-Qura University, Makkah |
| `5` | Egyptian General Authority of Survey |
| `7` | Institute of Geophysics, University of Tehran |
| `8` | Gulf Region |
| `9` | Kuwait |
| `10` | Qatar |
| `11` | Singapore (MUIS) |
| `12` | France (UOIF) |
| `13` | Turkey (Diyanet) |
| `15` | Moonsighting Committee Worldwide |
| `17` | Malaysia (JAKIM) |
| `18` | Tunisia |
| `19` | Algeria |
| `20` | Indonesia (Kemenag) |
| `21` | Morocco |
| `22` | Portugal |
| `23` | Jordan |
| `0` | Shia Ithna-Ashari, Leva Institute, Qum |

আসর school:

- `0` = শাফি (Shafi) — **ডিফল্ট**
- `1` = হানাফি (Hanafi)

---

## বাংলা ক্যালেন্ডার

NOOR CLI **সংশোধিত বাংলাদেশি বাংলা ক্যালেন্ডার** ব্যবহার করে:

- বাংলা বছর শুরু হয় **১৪ এপ্রিল** (পহেলা বৈশাখ)।
- বৈশাখ থেকে আশ্বিন — ৬টি মাস, প্রতিটি **৩১ দিন**।
- কার্তিক থেকে মাঘ — ৪টি মাস, প্রতিটি **৩০ দিন**।
- ফাল্গুন — **২৯ দিন**; যে বাংলা বছরের ফাল্গুন ইংরেজি অধিবর্ষে পড়ে সেখানে **৩০ দিন**।
- চৈত্র — **৩০ দিন**।
- বাংলা বছর = সংশ্লিষ্ট ইংরেজি বছরের শুরু থেকে ৫৯৩ বিয়োগ (যেমন ২০২৬ → ১৪৩৩)।

মাসের নাম: বৈশাখ, জ্যৈষ্ঠ, আষাঢ়, শ্রাবণ, ভাদ্র, আশ্বিন, কার্তিক, অগ্রহায়ণ, পৌষ, মাঘ, ফাল্গুন, চৈত্র।

বাংলা তারিখ সম্পূর্ণ স্থানীয়ভাবে গণনা করা হয়; এর জন্য ইন্টারনেট বা API লাগে না। হিজরি তারিখের জন্য AlAdhan API লাগে।

---

## API, ক্যাশ ও অফলাইন আচরণ

### কোন তথ্য কোথা থেকে আসে

| তথ্য | উৎস |
|---|---|
| ইংরেজি তারিখ, সময়, বাংলা তারিখ, ঋতু | স্থানীয়ভাবে (Luxon) |
| নামাজের সময় | AlAdhan `timingsByCity` |
| হিজরি তারিখ | নামাজের উত্তরের `date.hijri`; সমন্বয় থাকলে AlAdhan `gToH` |
| পরবর্তী নামাজ | স্থানীয়ভাবে নামাজের সময় ও বর্তমান সময় থেকে |

### ক্যাশ

- ডিফল্ট ক্যাশ পাথ: `~/.cache/noor-cli/cache.json`
- `XDG_CACHE_HOME` সেট থাকলে: `$XDG_CACHE_HOME/noor-cli/cache.json`
- তারিখ, শহর, দেশ, টাইমজোন, পদ্ধতি ও school অনুযায়ী আলাদা ক্যাশ
- **১৫ মিনিট** পর্যন্ত ক্যাশকে সতেজ ধরা হয়
- পুরোনো এন্ট্রি **১৪ দিন** বা সর্বোচ্চ **৩২টি** এন্ট্রি পর্যন্ত রাখা হয়
- ক্যাশ ফাইল নষ্ট হলে ব্যাকআপ রেখে উপেক্ষা করা হয়
- লেখা ব্যর্থ হলেও CLI চলতে থাকে

ড্যাশবোর্ডের `Source` ঘরে:

- `FRESH` — এই মুহূর্তে API থেকে আনা
- `CACHED` — সংরক্ষিত সফল উত্তর; ক্যাশের সময়ও দেখানো হয়
- `UNAVAILABLE` — নামাজের সময় পাওয়া যায়নি

### ইন্টারনেট বন্ধ থাকলে

- স্থানীয় সময়, ইংরেজি তারিখ, বাংলা তারিখ ও ঋতু দেখা যাবে
- নামাজের সময় ও হিজরি তারিখ `Unavailable` দেখাবে
- কোনো সময় অনুমান করে বসানো হয় না
- ক্যাশ থাকলে সর্বশেষ সফল তথ্য `CACHED` লেবেলসহ দেখানো হয়
- সংশ্লিষ্ট সতর্কবার্তা স্ট্ডেররে (stderr) দেখানো হয়
- প্রোগ্রাম `0` কোডে বন্ধ হয়, যাতে স্ক্রিপ্ট বা Termux উইজেট ব্যর্থ না হয়

### ইশার পর পরবর্তী ফজর

ইশার পর আজকের সময়সূচিতে আর কোনো নামাজ থাকে না। তখন CLI আগামীকালের ফজরের সময় আলাদাভাবে আনতে চেষ্টা করে। সেটি না পেলে "পরবর্তী নামাজ পাওয়া যায়নি" দেখায়; অনুমান করে সময় বসায় না। এতে ইশা → পরদিন ফজর এবং মধ্যরাত/টাইমজোন পরিবর্তন সঠিকভাবে সামলানো হয়।

### সমন্বয় (adjustment)

`hijriAdjustment` সেট করলে CLI মূল তারিখের সাথে দিন যোগ/বিয়োগ করে AlAdhan-এর `gToH` endpoint থেকে হিজরি তারিখ আনে। এটি API-এর সার্ভার-সাইড সমন্বয়ের বদলে স্থানীয়ভাবে হিসাব করা হয়, যাতে ফলাফল পরিষ্কার ও পূর্বানুমেয় থাকে। মান `-3` থেকে `+3`।

---

## পরিবেশ ভেরিয়েবল

সাধারণ ব্যবহারে দরকার নেই, তবে টেস্ট বা বিশেষ প্রয়োজনে:

| ভেরিয়েবল | কাজ |
|---|---|
| `NOOR_CONFIG_PATH` | কনফিগ ফাইলের পথ বদলায় |
| `NOOR_CACHE_PATH` | ক্যাশ ফাইলের পথ বদলায় |
| `NOOR_API_BASE_URL` | AlAdhan API-এর বেস URL বদলায় |
| `NOOR_TIMEOUT_MS` | API টাইমআউট (মিলিসেকেন্ড); ডিফল্ট `10000` |
| `NO_COLOR` | রং বন্ধ করে (যেকোনো মান) |
| `NOOR_ASCII` | `1` দিলে বর্ডার/প্রতীক ASCII-তে দেখায় |
| `XDG_CONFIG_HOME` | কনফিগ ডিরেক্টরি |
| `XDG_CACHE_HOME` | ক্যাশ ডিরেক্টরি |

উদাহরণ:

```bash
NOOR_CONFIG_PATH=/tmp/noor-test.json NOOR_CACHE_PATH=/tmp/noor-test-cache.json noor
NOOR_TIMEOUT_MS=20000 noor refresh
NO_COLOR=1 noor --bn
NOOR_ASCII=1 noor
```

> Termux-এ কিছু মোবাইল নেটওয়ার্ক ভাঙা IPv6 ঠিকানা দেয়। NOOR CLI শুরুতে IPv4-কে অগ্রাধিকার দেয় এবং Happy Eyeballs বন্ধ করে, যাতে `fetch` সময় নষ্ট না করে। IPv6-ওয়ার্ক থাকলে শুধু IPv6 থাকলেও এটি কাজ করে।

---

## টেস্ট চালানো

প্রজেক্ট ফোল্ডারে:

```bash
npm test
```

অথবা:

```bash
node --test
```

পরীক্ষাগুলো Node-এর বিল্ট-ইন টেস্ট রানার ব্যবহার করে এবং ইন্টারনেট ছাড়াই চলে (নকল/fake API ব্যবহার করে)। এগুলো কভার করে:

- সংশোধিত বাংলা ক্যালেন্ডার, মাসের দৈর্ঘ্য ও অধিবর্ষ
- বাংলা সংখ্যা ও সময় ফরম্যাট
- ১২/২৪ ঘণ্টা
- কনফিগ লোড, ভ্যালিডেশন, নষ্ট ফাইল ব্যাকআপ ও atomic save
- API টাইমআউট, HTTP ত্রুটি, ভুল/অনুপস্থিত ফিল্ড
- পরবর্তী নামাজ, সূর্যোদয়/সূর্যাস্ত বাদ, ইশা → পরদিন ফজর, মধ্যরাত
- ক্যাশ, stale fallback ও অফলাইন আচরণ
- ANSI-সচেতন টেবিল, ৪০/৮০ কলাম, বাংলা grapheme, সংকীর্ণ টার্মিনাল

সব পাস হলে শেষে `pass 67` দেখাবে।

---

## স্যাম্পল আউটপুট

সম্পূর্ণ স্যাম্পল: [`docs/sample-output.txt`](docs/sample-output.txt)

```text
╭─ DATE & TIME ────────────────────────────────────────────────╮
│ Local time    05:27:35 PM                                    │
│ English date  Sunday, 25 October 2026                        │
│ Bangla date   9 Kartik 1433                                  │
│ Hijri date    14 Jumada al-Awwal 1448                        │
│ Season        Late Autumn                                    │
│ City          Dhaka, Bangladesh                              │
│ Timezone      Asia/Dhaka (UTC+06:00)                         │
╰──────────────────────────────────────────────────────────────╯

╭─ PRAYER TIMES ───────────────────────────────────────────────╮
│ Prayer / Event      Time  Status                             │
│ ──────────────  ────────  ───────                            │
│ Fajr            04:44 AM  Passed                             │
│ Sunrise         06:00 AM  Event                              │
│ Dhuhr           11:42 AM  Passed                             │
│ Asr             03:00 PM  Passed                             │
│ Sunset          05:24 PM  Event                              │
│ Maghrib         05:24 PM  Current                            │
│ Isha            06:40 PM  Next                               │
╰──────────────────────────────────────────────────────────────╯
```

নমুনার সময় ২৫ অক্টোবর ২০২৬ (ঢাকা) তারিখে API থেকে আনা। ডিফল্ট আসর মাযহাব **শাফি (0)**; হানাফি হিসাব চাইলে `noor config school 1` দিন। রং এখানে বাদ দেওয়া হয়েছে; আসল CLI-তে পরবর্তী নামাজ সবুজাভ (emerald), হিজরি তারিখ সোনালি (gold) এবং সময়/তারিখ সায়ান রঙে দেখায়।

---

## কনফিগ ব্যাকআপ ও পুনরুদ্ধার

ব্যাকআপ:

```bash
mkdir -p ~/noor-backup
cp ~/.config/noor-cli/config.json ~/noor-backup/config.json
```

ফোনের স্টোরেজে রাখতে:

```bash
cp ~/.config/noor-cli/config.json ~/storage/shared/noor-config-backup.json
```

পুনরুদ্ধার:

```bash
mkdir -p ~/.config/noor-cli
cp ~/noor-backup/config.json ~/.config/noor-cli/config.json
chmod 600 ~/.config/noor-cli/config.json
```

ক্যাশ মুছতে:

```bash
rm -f ~/.cache/noor-cli/cache.json
```

কনফিগ ফাইল হাতে সম্পাদনা করলেও চলবে। অজানা কী উপেক্ষা করা হয় এবং ভুল মানের জন্য ডিফল্ট ব্যবহার করে সতর্কবার্তা দেখানো হয়। সম্পূর্ণ ভাঙা JSON হলে `.invalid-<timestamp>` ব্যাকআপ তৈরি হয়।

---

## আনইনস্টল

`npm link` দিয়ে ইনস্টল করলে:

```bash
npm unlink -g noor-cli
```

`npm install -g .` দিয়ে করলে:

```bash
npm uninstall -g noor-cli
```

এরপর প্রজেক্ট ফোল্ডার মুছে ফেলুন:

```bash
rm -rf ~/noor-cli
```

ঐচ্ছিকভাবে কনফিগ ও ক্যাশ:

```bash
rm -rf ~/.config/noor-cli ~/.cache/noor-cli
```

`~/.bashrc`-এ যোগ করা alias থাকলে সেটিও মুছে ফেলুন।

---

## সমস্যা সমাধান

### `noor: command not found`

`npm link` চালান, তারপর শেল রিফ্রেশ করুন:

```bash
cd ~/noor-cli
npm link
hash -r
noor --version
```

না হলে সরাসরি চালান:

```bash
node ~/noor-cli/src/index.js
```

### `npm link` অনুমতি ত্রুটি

Termux-এ সাধারণত লাগে না। প্রয়োজন হলে নিজের prefix ব্যবহার করুন:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
cd ~/noor-cli && npm link
```

### `fetch failed`, `ETIMEDOUT` বা `ENETUNREACH`

- ইন্টারনেট সংযোগ পরীক্ষা করুন: `curl -I https://api.aladhan.com`
- DNS ঠিক আছে কি না দেখুন: `getent hosts api.aladhan.com`
- VPN/প্রক্সি বন্ধ করে দেখুন
- টাইমআউট বাড়ান: `NOOR_TIMEOUT_MS=20000 noor refresh`
- কিছুক্ষণ পর আবার চেষ্টা করুন; AlAdhan সাময়িকভাবে ডাউন থাকতে পারে
- ক্যাশ থাকলে অফলাইনেও পুরোনো তথ্য দেখাবে

### নামাজের সময় ভুল দেখাচ্ছে

1. শহর ও দেশ ঠিক আছে কি না দেখুন: `noor config`
2. টাইমজোন শহরের সাথে মিলছে কি না দেখুন। যেমন লন্ডনের জন্য `Europe/London`
3. হিসাব পদ্ধতি বদলে দেখুন: `noor config method 1` বা `noor config method 2`
4. আসর মাযহাব: `noor config school 0` (শাফি, ডিফল্ট) বা `1` (হানাফি)
5. `noor refresh` চালান

AlAdhan-এর হিসাব ভিন্নও হতে পারে; স্থানীয় মসজিদের সময়সূচির সাথে মিলিয়ে দেখুন এবং প্রয়োজন অনুযায়ী পদ্ধতি বদলান।

### হিজরি তারিখ এক দিন আলাদা

এটি স্বাভাবিক। স্থানীয় চাঁদ দেখার ভিত্তিতে তারিখ এক দিন আগে/পরে হতে পারে। সমন্বয়:

```bash
noor config adjustment 1    # এক দিন সামনে
noor config adjustment -1   # এক দিন পিছনে
noor config adjustment 0    # সমন্বয় বন্ধ
```

### বাংলা তারিখ ভুল মনে হচ্ছে

NOOR CLI সংশোধিত বাংলাদেশি বাংলা ক্যালেন্ডার (১৪ এপ্রিল শুরু) ব্যবহার করে। পুরোনো বাংলা পঞ্জিকা বা অন্য অঞ্চলের নিয়মের সাথে পার্থক্য থাকতে পারে। বাংলা তারিখ স্থানীয়ভাবে গণনা হয়, তাই API বা ইন্টারনেট এর উপর প্রভাব ফেলে না।

### টার্মিনালে বর্ডার ভাঙা বা লেখা কেটে যাচ্ছে

- টার্মিনাল ফন্টে ইউনিকম্বক্স ও বাংলা গ্লিফ থাকতে হবে
- সংকীর্ণ টার্মিনালে ২০ কলাম পর্যন্ত সমর্থিত; এর কম হলে টেক্সট মোড়ানো হতে পারে
- ASCII মোড: `NOOR_ASCII=1 noor`
- রং বন্ধ: `NO_COLOR=1 noor`
- Termux-এ ফন্ট সাইজ ছোট করে বা টার্মিনাল প্রস্থ বাড়িয়ে দেখুন

### রং দেখা যাচ্ছে না

আউটপুট TTY না হলে (যেমন ফাইলে রিডাইরেক্ট করলে) রং স্বয়ংক্রিয়ভাবে বন্ধ হয়। জোর করে চালাতে:

```bash
FORCE_COLOR=1 noor
```

### ক্যাশ নষ্ট হয়েছে

CLI নিজেই `.invalid-<timestamp>` ব্যাকআপ তৈরি করে। সমস্যা থাকলে ক্যাশ মুছে দিন:

```bash
rm -f ~/.cache/noor-cli/cache.json
noor refresh
```

### সময় অঞ্চল বা তারিখ পরিবর্তনের পরও পুরোনো তথ্য

ক্যাশ ১৫ মিনিট পর্যন্ত সতেজ থাকে। জোর করে নতুন তথ্য আনতে:

```bash
noor refresh
```

---

## প্রকল্পের গঠন

```text
noor-cli/
├── src/
│   ├── index.js              # executable entry point
│   ├── cli.js                # argument parsing ও command flow
│   ├── config.js             # কনফিগ load/save/validate
│   ├── cache.js              # atomic JSON response cache
│   ├── api/aladhan.js        # AlAdhan client, timeout, errors
│   ├── services/
│   │   ├── banglaCalendar.js # সংশোধিত বাংলা ক্যালেন্ডার
│   │   ├── dateService.js    # তারিখ/সময়/ঋতু
│   │   ├── hijriService.js   # হিজরি তারিখ ও সমন্বয়
│   │   └── prayerService.js  # নামাজের অবস্থা, next prayer, cache flow
│   ├── ui/
│   │   ├── banner.js         # figlet ব্যানার
│   │   ├── colors.js         # theme, color/Unicode fallback
│   │   ├── configView.js     # কনফিগ ভিউ
│   │   ├── dashboard.js      # ড্যাশবোর্ড
│   │   ├── i18n.js           # বাংলা/ইংরেজি স্ট্রিং
│   │   └── table.js          # ANSI-aware width, wrapping, panels
│   └── utils/                # constants, numbers, time, validation, version
├── test/                     # Node test runner টেস্ট
├── docs/sample-output.txt    # যাচাই করা স্যাম্পল আউটপুট
├── package.json
└── README.md
```

---

## লাইসেন্স

MIT License। বিস্তারিত: [`LICENSE`](LICENSE)

---

**NOOR CLI** — Where Time Meets Tranquility
