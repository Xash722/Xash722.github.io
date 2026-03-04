---
title: ffuf
parent: Tools
nav_order: 1
---

# ffuf

디렉토리 및 파라미터 퍼징/무차별 대입 공격에 많이 쓰이는 도구 중 하나이다.

다음과 같은 용도로 사용할 수 있다.

- 디렉토리 퍼징
- 파일 및 확장자 퍼징
- 숨겨진 가상 호스트(vhost) 식별
- php 파라미터 퍼징
- 파라미터 이름 퍼징 (GET/POST/JSON 등)
- 파라미터 값 퍼징

웹 사이트에 단서가 없으면 숨겨진 디렉터리와 페이지를 찾기 위해 퍼징을 한다.

ffuf는 초당 수백 건의 요청을 보내 응답 코드에 따라 존재 여부를 판별한다.

ffuf에는 워드리스트가 필요하며 주로 SecLists를 사용한다.

> 해당 워드리스트 앞부분의 주석/저작권 문구는 결과를 지저분하게 만들 수 있기 때문에 `-ic` 옵션을 사용해서 제거한다.



| 작업                              | SecLists 워드리스트                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1) 디렉토리/페이지(엔드포인트) 퍼징           | `Discovery/Web-Content/common.txt`<br>`Discovery/Web-Content/raft-small-directories.txt`<br>`Discovery/Web-Content/raft-medium-directories.txt`<br>`Discovery/Web-Content/raft-medium-directories-lowercase.txt` (대상 경로가 소문자 위주일 때)                                                                                    |
| 2) 파일명 퍼징                       | `Discovery/Web-Content/raft-small-files.txt`<br>`Discovery/Web-Content/raft-medium-files.txt`                                                                                                                                                                                                                          |
| 3) 확장자 퍼징                       | `Discovery/Web-Content/web-extensions.txt`<br>`Discovery/Web-Content/raft-small-extensions.txt`<br>`Discovery/Web-Content/raft-medium-extensions.txt`                                                                                                                                                                  |
| 4) VHOST(Host 헤더) / 서브도메인 후보 퍼징 | `Discovery/DNS/subdomains-top1million-5000.txt` → `...-20000.txt` → `...-110000.txt`                                                                                                                                                                                                                                   |
| 5) 파라미터 이름 퍼징                   | `Discovery/Web-Content/burp-parameter-names.txt`                                                                                                                                                                                                                                                                       |
| 6) 파라미터 값 퍼징(목적별)               | (코드/핀/OTP) `Fuzzing/4-digits-0000-9999.txt` → `Fuzzing/5-digits-00000-99999.txt` → `Fuzzing/6-digits-000000-999999.txt` <br>(LFI/경로탐색) `Fuzzing/LFI/LFI-Jhaddix.txt` <br>(XSS/URI 컨텍스트) `Fuzzing/URI-XSS.fuzzdb.txt` <br>(JSON 입력) `Fuzzing/JSON.Fuzzing.txt` <br>(범용 엣지케이스) `Fuzzing/big-list-of-naughty-strings.txt` |
| 7) API 엔드포인트 퍼징                 | `Discovery/Web-Content/common-api-endpoints-mazen160.txt`<br>`Discovery/Web-Content/api/api-endpoints.txt`                                                                                                                                                                                                             |


# 디렉토리 퍼징

핵심 옵션 두 가지는 워드 리스트를 지정하는 `-w`와 url을 지정하는 `-u`

퍼징을 수행하고 싶은 위치에서 특정 워드리스트를 특정 키워드에 할당 할 수 있다.

```
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt:FUZZ
```

FUZZ라는 키워드에 common.txt를 할당했다.
만약 웹 디렉터리 대상으로 퍼징을 하고 싶다면 URL에서 퍼징을 하고 싶은 위치에 FUZZ 키워드를 넣으면 된다.

```
ffuf -w <워드리스트> -u http://ip주소:포트번호/FUZZ
```

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/1_directory.png' | relative_url }}" style="width:700px;">
    <figcaption>디렉토러 퍼징</figcaption>
</figure>
<br>

blog와 forum을 발견했다.

# 확장자 퍼징

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/2_page.png' | relative_url }}" style="width:700px;">
    <figcaption>디렉토리 퍼징</figcaption>
</figure>
<br>

위에서 발견함 blog와 forum에 가보면 아무것도 나오지 않는 것을 볼 수 있다.
이번엔 웹 페이지의 확장자 퍼징으로 해당 디렉터리에 숨겨진 페이지가 있는지 확인해본다.
대부분의 웹 사이트에 존재하는 index 파일을 이용해서 확장자를 찾아본다
이번엔 확장자가 들어갈 위치에 FUZZ를 넣으면 된다.
확장자 퍼징에 쓰이는 워드리스트에는 `.`이 포함되어 있으므로 FUZZ 앞에 `.`을 따로 추가할 필요 없다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/tools/ffuf/3_extension.png' | relative_url }}" style="width:700px;">
    <figcaption>확장자 퍼징</figcaption>
</figure>
<br>

PHP만 상태코드 200이 나온다.
그럼 이제 웹 사이트가 php로 동작한다는 정보를 얻었으니 php 파일을 대상으로 퍼징을 하면 된다.

# 페이지 퍼징



