// Supplemental pools for bigrams / hold / pulse drills.
export const EXTRA_POOLS = {
  bigrams: ["th","he","in","er","an","re","on","at","en","nd","ti","es","or","te","of","ed","is","it","al","ar","st","to","nt","ng","se","ha","as","ou","io","le","ve","co","me","de","hi","ri","ro","ic","ne","ea","ra","ce","li","ch","ll","be","ma","si","om","ur","ca","el","la","ns","di","fo","ho","pe","ec","pr","the","and","ing","ion","ent","for","her","ter","hat","tha","ere","ate","his","con","res","ver","all","ons","nce","men","ith","ted","ers","pro","thi","wit","are","ess","not","ive","was","ect","rea","com","eve","per","int","est","sta","cti","ica","ist","ear","own","one","our","out","use","how","man","new","now","way","may","say","she","two","who","oil","sit","set","run","let","put","end","why","try","ask","th th","he he","in in","er er","an an","the the","and and","ing ing","ion ion","ent ent","that","with","have","this","will","your","from","they","been","call","each","which","their","said","there","about","would","make","like","time","very","when","come","here","just","into","year","over"],
  'hold-drill': ["←←", "→→", "↑↑", "↓↓", "←→", "→←", "↑↓", "↓↑", "←↓↑→", "→↑↓←", "←←→→", "↑↑↓↓", "←→←→", "↑↓↑↓", "←←←", "→→→", "↑↑↑", "↓↓↓", "←↓←↓", "→↑→↑", "↑→↑→", "↓←↓←", "←↑←↑", "→↓→↓", "↑←↑←", "↓→↓→", "←→↑↓", "→←↓↑", "↑↓←→", "↓↑→←", "←↓→↑", "→↑←↓", "↑→↓←", "↓←↑→", "←←↓↓", "→→↑↑", "↑↑←←", "↓↓→→", "←→→←", "↑↓↓↑", "→←←→", "↓↑↑↓", "←↑→↓←↑→↓", "→↓←↑→↓←↑", "↑→↓←↑→↓←", "↓←↑→↓←↑→", "←←↑↑→→↓↓", "→→↓↓←←↑↑", "↑↑→→↓↓←←", "↓↓←←↑↑→→", "←↓↑→←↓↑→", "→↑↓←→↑↓←", "↑←↓→↑←↓→", "↓→↑←↓→↑←"],
  'pulse-drill': ["a1","b2","c3","x9","y0","n1","m2","a1b","x2y","a=1","b=2","x=3","n=0","i=1","a[0]","b[1]","x[2]","a1a","b2b","1a1","2b2","x!","y!","ok!","go!","a$","b$","#1","#2","@a","@b","a&b","x*y","a-b","x=y","a_b","c|d","~a","a+b","[a]","{x}","`a`","a\\b","v1","v2","v1.0","v2.1","a1 a2","x9 y0","n=1;","i=0;","a[1]=2","x!=y","a&1","b|2","$5","10%","#9","@x","let x=1","var n=2","id=7","a+1","b-2","c*3","d/4","x^2","n%2","a_1","b-2","c.3","hi!","no!","yes!","ok.","a,b","x.y","1st","2nd","3rd","q1","q2","fy24","v3.14"],

  // Eyelash Sofle: real GASC home-row mod COMBOS (hold HRM → OS sends Ctrl/Alt/GUI/Shift).
  // Avoid browser/OS focus-stealers (Alt+Tab, Ctrl+W/T/N, Meta+W, …). Editing combos only.
  'home-row-mods': [
    "Ctrl+c","Ctrl+v","Ctrl+x","Ctrl+z","Ctrl+a","Ctrl+s","Ctrl+f","Ctrl+b","Ctrl+y",
    "GUI+c","GUI+v","GUI+x","GUI+z","GUI+a","GUI+s","GUI+f",
    "Alt+f","Alt+b","Alt+s","Alt+d","Alt+v","Alt+x","Alt+z","Alt+c","Alt+a",
    "Shift+a","Shift+s","Shift+d","Shift+f","Shift+g","Shift+h","Shift+j","Shift+k","Shift+l","Shift+z","Shift+x","Shift+c","Shift+v",
    "Ctrl+Shift+c","Ctrl+Shift+v","Ctrl+Shift+z","Ctrl+Shift+a","Ctrl+Shift+s","Ctrl+Shift+f",
    "GUI+Shift+c","GUI+Shift+v","GUI+Shift+z","GUI+Shift+s",
    "Alt+Shift+f","Alt+Shift+b","Alt+Shift+s",
    "Ctrl+c","Ctrl+v","Ctrl+x","Ctrl+z","Ctrl+a","Ctrl+s",
    "GUI+c","GUI+v","Alt+f","Alt+b","Shift+a","Shift+z",
  ],
  // High-repetition tap drills for mod keys (intro-sandwich + rolls).
  'hrm-tap': [
    "aaa sas dad faf gag hah jaj kak lal",
    "asa sss dsd fsf gsg hsh jsj ksk lsl",
    "ada sds ddd fdf gdg hdh jdj kdk ldl",
    "afa sfs dfd fff gfg hfh jfj kfk lfl",
    "aja sjs djd fjf gjg hjh jjj kjk ljl",
    "aka sks dkd fkf gkg hkh jkj kkk lkl",
    "ala sls dld flf glg hlh jlj klk lll",
    "a;a s;s d;d f;f g;g h;h j;j k;k l;l",
    "asdf jkl;","fds; lkja","asdfasdf","jkl;jkl;",
    "as df jk l;","a s d f j k l ;","fasd ;lkj","sfad jkl;",
    "dafs ;jkl","afsd lk;j","aaaa ssss","dddd ffff",
    "jjjj kkkk","llll ;;;;","asdf ;lkj asdf","jkl; fdsa jkl;",
    "ask ask ask","dad dad dad","all all all","fall fall",
    "flask flask","salad salad","lass lass","adds adds","fads fads",
  ],
  // Nav (hold Space / L41): brackets on U I O P / N M — no paging on this layer.
  'nav-brackets': [
    "[]","{}","()","[[]]","{{}}","(())","[{}]","({})","[()]",
    "{[]}","([])","{[()]}","[]{}","()[]","{}()","[]()","{}[]","(){}",
    "[()]{}","{[]}()","([])[]","[[","]]","{{","}}","((","))",
    "[][]","{}{}","()()","][","}{",")(","[{()}]","{([])}","([{}])",
    "[]{}()","()[]{}","{}()[]","[[[]]]","{{{}}}","((()))",
    "[{[]}]","{({})}","[()][()]","{}{}{}","[][][]","()()()",
    "][}{)(","[{}]()","({})[]","[()]{}","[[][]]","{{}{}}","(()())",
    "[{}{}]","{()()}","([()])","[{}][{}]","()()()","[]{}[]",
    "{()}","[()]","([])","[{}]","{[]}","({})","[[]()]","{{}()}",
    "(()[])","[{}()]","{([])}","([{}])","[]{()}","()[{}]","{}[()]",
    "][][","}{}{",")()(",
    "[[[]]]","{{{}}}","(((())))","[{({})}]","{([()])}","([{}{}])",
  ],
};

// Drop glyphs absent from Eyelash BASE/NAV/SYM tutor slots (= and backslash are Num-hold).
for (const [name, items] of Object.entries(EXTRA_POOLS)) {
  EXTRA_POOLS[name] = items.filter((item) => !/[=\\]/.test(item));
}
