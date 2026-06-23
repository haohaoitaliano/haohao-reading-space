begin;

do $$
declare
  beta_camp_id uuid;
  admin_id uuid;
  new_course_id uuid;
  course_data jsonb;
  vocabulary_data jsonb;
  vocabulary_position bigint;
  course_seed jsonb := $seed$
  [
    {
      "day": 1,
      "italian_title": "Un nuovo inizio",
      "chinese_title": "一个新的开始",
      "description": "慢慢读出第一段开场文字，找到属于自己的阅读节奏。",
      "reading_text": "Oggi comincia un piccolo viaggio. Ogni parola letta con calma ci porta più vicino alla lingua italiana.",
      "reflection_zh": "读完后，你对这段新的旅程有什么期待？",
      "reflection_it": "Che cosa ti aspetti da questo nuovo viaggio?",
      "vocabulary": [{"word":"viaggio","meaning":"旅程"},{"word":"calma","meaning":"平静、从容"},{"word":"vicino","meaning":"靠近的"}]
    },
    {
      "day": 2,
      "italian_title": "La finestra aperta",
      "chinese_title": "打开的窗",
      "description": "练习清楚读出元音，留意清晨城市的声音。",
      "reading_text": "Apro la finestra e ascolto la città. Le voci del mattino sembrano leggere insieme a me.",
      "reflection_zh": "这段文字让你想起了怎样的清晨？",
      "reflection_it": "A quale mattino ti fa pensare questo testo?",
      "vocabulary": [{"word":"finestra","meaning":"窗户"},{"word":"ascolto","meaning":"我听"},{"word":"mattino","meaning":"早晨"}]
    },
    {
      "day": 3,
      "italian_title": "Una parola gentile",
      "chinese_title": "一句温柔的话",
      "description": "感受一句温柔的话如何改变一天的节奏。",
      "reading_text": "Una parola gentile può cambiare il ritmo della giornata e rendere più leggero il cuore.",
      "reflection_zh": "你最近听到过哪一句温柔的话？",
      "reflection_it": "Quale parola gentile hai sentito di recente?",
      "vocabulary": [{"word":"gentile","meaning":"温柔的、有礼貌的"},{"word":"ritmo","meaning":"节奏"},{"word":"leggero","meaning":"轻盈的"}]
    },
    {
      "day": 4,
      "italian_title": "Il profumo del pane",
      "chinese_title": "面包的香气",
      "description": "练习描述生活中的气味和画面。",
      "reading_text": "Davanti al forno, il profumo del pane caldo mi ricorda le strade tranquille di un paese italiano.",
      "reflection_zh": "读完这段文字后，你有什么感受或联想？可以说说哪一句话打动了你、你想到了什么，或者你学到了什么。",
      "reflection_it": "Riflessione dopo la lettura",
      "vocabulary": [{"word":"forno","meaning":"烤炉、面包店"},{"word":"profumo","meaning":"香气"},{"word":"tranquille","meaning":"安静的"},{"word":"paese","meaning":"小镇、村庄"}]
    },
    {
      "day": 5,
      "italian_title": "La piazza di sera",
      "chinese_title": "傍晚的广场",
      "description": "观察傍晚广场的光线、人群与缓慢节奏。",
      "reading_text": "La piazza di sera si illumina piano, mentre le persone parlano e camminano senza fretta.",
      "reflection_zh": "你喜欢怎样的傍晚？",
      "reflection_it": "Come immagini una serata tranquilla in piazza?",
      "vocabulary": [{"word":"piazza","meaning":"广场"},{"word":"illumina","meaning":"照亮"},{"word":"senza fretta","meaning":"不着急"}]
    },
    {
      "day": 6,
      "italian_title": "Lettera a un'amica",
      "chinese_title": "写给朋友的信",
      "description": "用简单的句子表达想念、分享和新的发现。",
      "reading_text": "Cara amica, oggi ho letto una pagina semplice, ma dentro c'era una luce nuova.",
      "reflection_zh": "如果写给朋友，你最想分享今天的什么？",
      "reflection_it": "Che cosa vorresti raccontare oggi a un'amica?",
      "vocabulary": [{"word":"cara","meaning":"亲爱的"},{"word":"pagina","meaning":"一页"},{"word":"luce","meaning":"光"}]
    },
    {
      "day": 7,
      "italian_title": "Rileggere piano",
      "chinese_title": "慢慢重读",
      "description": "在重读中听见句子的呼吸，也回看这一周的变化。",
      "reading_text": "Rileggere piano significa ascoltare meglio: la frase torna, respira, e diventa più nostra.",
      "reflection_zh": "这一周，你最想重新读哪一句话？",
      "reflection_it": "Quale frase vorresti rileggere alla fine di questa settimana?",
      "vocabulary": [{"word":"rileggere","meaning":"重读"},{"word":"respira","meaning":"呼吸"},{"word":"nostra","meaning":"我们的"}]
    }
  ]
  $seed$::jsonb;
begin
  if jsonb_array_length(course_seed) <> 7 then
    raise exception 'Course seed must contain exactly seven courses.';
  end if;

  select id into beta_camp_id
  from public.camps
  where slug = 'reading-beta-7d'
  limit 1;

  select id into admin_id
  from public.profiles
  where role = 'admin' and status = 'active'
  order by created_at
  limit 1;

  if beta_camp_id is null or admin_id is null then
    raise exception 'Create reading-beta-7d and an active admin before running this seed.';
  end if;

  for course_data in select value from jsonb_array_elements(course_seed)
  loop
    new_course_id := null;

    insert into public.courses (
      camp_id, day_number, italian_title, chinese_title, unlock_at,
      status, created_by, updated_by
    )
    values (
      beta_camp_id,
      (course_data ->> 'day')::integer,
      course_data ->> 'italian_title',
      course_data ->> 'chinese_title',
      case
        when (course_data ->> 'day')::integer <= 4
          then now() - make_interval(days => 5 - (course_data ->> 'day')::integer)
        else now() + make_interval(days => (course_data ->> 'day')::integer - 4)
      end,
      'published',
      admin_id,
      admin_id
    )
    on conflict (camp_id, day_number) do nothing
    returning id into new_course_id;

    if new_course_id is not null then
      insert into public.course_contents (
        course_id, description, reading_text,
        reflection_prompt_zh, reflection_prompt_it, updated_by
      )
      values (
        new_course_id,
        course_data ->> 'description',
        course_data ->> 'reading_text',
        course_data ->> 'reflection_zh',
        course_data ->> 'reflection_it',
        admin_id
      );

      for vocabulary_data, vocabulary_position in
        select value, ordinality
        from jsonb_array_elements(course_data -> 'vocabulary') with ordinality
      loop
        insert into public.course_vocabulary (course_id, position, word, meaning_zh)
        values (
          new_course_id,
          vocabulary_position::integer,
          vocabulary_data ->> 'word',
          vocabulary_data ->> 'meaning'
        );
      end loop;
    end if;
  end loop;
end;
$$;

commit;
