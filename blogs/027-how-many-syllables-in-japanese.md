---
title: 日语中有多少不同音节
slug: how-many-syllables-in-japanese
date: 2024-07-24
abstract: 
---

## 问题来源

有日语学习经验的同学都知道，日语是一种音节比较单纯的语言。那么日语有多少种不同音节呢？不止50音图里的50个。

## 音节

根据我浅薄的语言学知识，一个音节是

```
[辅音]元音[韵尾]
```

的组合，其中 `[辅音]` 和 `[韵尾]` 都可以省略。因此下面的音都是不同的音节

1. a
2. ta
3. yan

那么我们就可以考虑日语中有哪些合法的 `[辅音]元音[韵尾]` 组合来计算一共有多少不同的音节。

## 日语的元音

基础的元音当然是 `a i u e o`。

元音也可以有不同的变体，例如 `a`, `u`, `o` 可以在部分辅音后变化为拗音：

1. `kya`
2. `kyu`
3. `kyo`

同时日语中拉长的元音被视为不同的元音，因此又有

1. `aa`
2. `ii`
3. `uu`
4. `ee`
5. `oo`

长音中的 `aa`, `uu`, `oo` 同样可以拗音化。

如上是日语所有的元音，共 5 个元音，6 个拗音，5 个长音，一共 16 个。

## 日语中的辅音

日语中的辅音就是五十音图中出现的辅音，共 14 个。

1. `k`
2. `s`
3. `t`
4. `n`
5. `h`
6. `m`
7. `y`
8. `r`
9. `w`
10. `g`
11. `z`
12. `b`
13. `p`
14. `d`

## 日语中的韵尾

日语的韵尾只有拨音 `n`。

## 日语中音节的组合

如果简单将这些组合相乘，我们会得到一个很大的结果：

```
16 * (14 + 1) * (1 + 1) = 480
// 16 个元音 * 14 个辅音及没有辅音 * 有无 n 韵尾
```

这远远超过 50 个，但是实际上并不准确，因为有些发音在日语中并不存在。这些规则比较细碎，这里简单列举一下：

1. `y` 后没有 `yi`, `ye` 这些发音
2. 正常来说 `w` 后面只能跟 `wa`, `waa`，但是实际上由于外来语，没有这个限制了。`wi (ウィ)` `we (ワェ)` `wo (ワォ)` 都是合法的，但是 `wu` 和 `u` 不区分。

根据上面的讨论，可以写出如下的 Python 脚本计算有多少中不同的组合 

```python
r = []

for v in ["a", "i", "u", "e", "o", "aa", "ii", "uu", "ee", "oo"]:
    for c in ["", "k", "s", "t", "n", "h", "m", "y", "r", "w", "g", "z", "b", "p", "d"]:
        for yoon in ["", "y"]:
            for nn in ["", "n"]:
                if yoon == "y":
                    if c in ["y", "w", "d"]:
                        continue
                    if v in ["i", "e", "ii", "ee"]:
                        continue
                if c == "y":
                    if v in ["i", "e", "ii", "ee"]:
                        continue
                if c == "w":
                    if v in ["u", "uu"]:
                        continue
                r.append(c + yoon + v + nn)

for i, c in enumerate(r):
    print(c, end="\t")
    if i % 5 == 4:
        print(i + 1)
print(len(r))
```

结果是

```
a       an      ya      yan     ka      5
kan     kya     kyan    sa      san     10
sya     syan    ta      tan     tya     15
tyan    na      nan     nya     nyan    20
ha      han     hya     hyan    ma      25
man     mya     myan    ya      yan     30
ra      ran     rya     ryan    wa      35
wan     ga      gan     gya     gyan    40
za      zan     zya     zyan    ba      45
ban     bya     byan    pa      pan     50
pya     pyan    da      dan     i       55
in      ki      kin     si      sin     60
ti      tin     ni      nin     hi      65
hin     mi      min     ri      rin     70
wi      win     gi      gin     zi      75
zin     bi      bin     pi      pin     80
di      din     u       un      yu      85
yun     ku      kun     kyu     kyun    90
su      sun     syu     syun    tu      95
tun     tyu     tyun    nu      nun     100
nyu     nyun    hu      hun     hyu     105
hyun    mu      mun     myu     myun    110
yu      yun     ru      run     ryu     115
ryun    gu      gun     gyu     gyun    120
zu      zun     zyu     zyun    bu      125
bun     byu     byun    pu      pun     130
pyu     pyun    du      dun     e       135
en      ke      ken     se      sen     140
te      ten     ne      nen     he      145
hen     me      men     re      ren     150
we      wen     ge      gen     ze      155
zen     be      ben     pe      pen     160
de      den     o       on      yo      165
yon     ko      kon     kyo     kyon    170
so      son     syo     syon    to      175
ton     tyo     tyon    no      non     180
nyo     nyon    ho      hon     hyo     185
hyon    mo      mon     myo     myon    190
yo      yon     ro      ron     ryo     195
ryon    wo      won     go      gon     200
gyo     gyon    zo      zon     zyo     205
zyon    bo      bon     byo     byon    210
po      pon     pyo     pyon    do      215
don     aa      aan     yaa     yaan    220
kaa     kaan    kyaa    kyaan   saa     225
saan    syaa    syaan   taa     taan    230
tyaa    tyaan   naa     naan    nyaa    235
nyaan   haa     haan    hyaa    hyaan   240
maa     maan    myaa    myaan   yaa     245
yaan    raa     raan    ryaa    ryaan   250
waa     waan    gaa     gaan    gyaa    255
gyaan   zaa     zaan    zyaa    zyaan   260
baa     baan    byaa    byaan   paa     265
paan    pyaa    pyaan   daa     daan    270
ii      iin     kii     kiin    sii     275
siin    tii     tiin    nii     niin    280
hii     hiin    mii     miin    rii     285
riin    wii     wiin    gii     giin    290
zii     ziin    bii     biin    pii     295
piin    dii     diin    uu      uun     300
yuu     yuun    kuu     kuun    kyuu    305
kyuun   suu     suun    syuu    syuun   310
tuu     tuun    tyuu    tyuun   nuu     315
nuun    nyuu    nyuun   huu     huun    320
hyuu    hyuun   muu     muun    myuu    325
myuun   yuu     yuun    ruu     ruun    330
ryuu    ryuun   guu     guun    gyuu    335
gyuun   zuu     zuun    zyuu    zyuun   340
buu     buun    byuu    byuun   puu     345
puun    pyuu    pyuun   duu     duun    350
ee      een     kee     keen    see     355
seen    tee     teen    nee     neen    360
hee     heen    mee     meen    ree     365
reen    wee     ween    gee     geen    370
zee     zeen    bee     been    pee     375
peen    dee     deen    oo      oon     380
yoo     yoon    koo     koon    kyoo    385
kyoon   soo     soon    syoo    syoon   390
too     toon    tyoo    tyoon   noo     395
noon    nyoo    nyoon   hoo     hoon    400
hyoo    hyoon   moo     moon    myoo    405
myoon   yoo     yoon    roo     roon    410
ryoo    ryoon   woo     woon    goo     415
goon    gyoo    gyoon   zoo     zoon    420
zyoo    zyoon   boo     boon    byoo    425
byoon   poo     poon    pyoo    pyoon   430
doo     doon    432
```

一共 432 个不同的发音。看来，日语的发音还不少呢。

当然其中不少是传统日语的比较罕见的组合，他们并非不可能，但是通常只在外来语中出现：

1. 长音 + 拨音的组合，例如 `taan`。英语外来语 `turn ターン` 是这个发音。
2. `di ディ`, `ti　ティ` 这类本来和 `ji じ`, `ti ち` 合并的发音。也是因为外来语复活了。
3. `dya (嗲)`, `dyu (丢)` 这类我不太确定是不是合法的发音。

总之，日语中最大可能有这么 432 种发音。我们可以和别的语言比较一下：

| 语言 | 音节 |
| -------- | ------- |
| 日语 | 432 |
| 汉语普通话 | 1200+ |
| 德语 | 5000+ |
| 英语 | 8000+ |
| 韩语 | 11172 |

（除日语外我都是道听途说的，没有论证）

### 对比汉字圈语言

所以，在单位音节的丰富程度上，日语是中文的 1/3，韩语的 3%，这也一定程度上反映了为何中文，日文无法在书写上放弃汉字（单纯依靠字音表意能力不足），而韩语可以脱离汉字。

## 结尾

这篇文章是在搜索“日语有多少不同音节”这个问题后无所获后，想搞清楚这个问题而写的。由于日语的拼读规则实际上在外语入侵后也扩充了不少，所以 432 个不同发音实际上是个乐观的估计。也许应该再根据传统日语规则统计一下传统日语中有多少音节？我认为结果可能会远低于 432 个。