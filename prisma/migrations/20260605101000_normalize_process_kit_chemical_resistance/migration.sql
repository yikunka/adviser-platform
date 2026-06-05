UPDATE "cos_process_kits"
SET "performanceStandards" = (
  SELECT ARRAY(
    SELECT standard
    FROM (
      SELECT standard, MIN(position) AS first_position
      FROM unnest(
        array_append(
          array_remove(
            array_remove(
              array_remove("performanceStandards", 'ALCOHOL_99_100'),
              'ALCOHOL_75_100'
            ),
            'MEK_100'
          ),
          'CHEMICAL_RESISTANCE'
        )
      ) WITH ORDINALITY AS normalized(standard, position)
      GROUP BY standard
      ORDER BY MIN(position)
    ) deduped
  )
)
WHERE "performanceStandards" && ARRAY['ALCOHOL_99_100', 'ALCOHOL_75_100', 'MEK_100']::TEXT[];
