Feature: Scores scale to the size of the play area

  Scenario Outline: The same miss is worth more in a bigger area
    Given a play area whose diameter is <diameter> km
    When a player guesses <miss> km from the location
    Then they score <score> points

    Examples:
      | diameter | miss | score |
      | 20015    | 2000 | 3026  |
      | 1171     | 100  | 3282  |
      | 1171     | 600  | 0     |
