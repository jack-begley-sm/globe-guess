Feature: A play area knows how big it is

  Scenario: The World region spans the whole world, not just its corners
    Given the built-in World play area
    Then its scale is 20015 km give or take 20 km

  Scenario Outline: Built-in regions have their own scale
    Given the built-in <region> play area
    Then its scale is <scale> km give or take 20 km

    Examples:
      | region   | scale |
      | UK       | 1171  |
      | EUROPE   | 6232  |
      | AMERICAS | 17305 |
      | AFRICA   | 10783 |
      | ASIA     | 13260 |
      | OCEANIA  | 7684  |

  Scenario: A small drawn area has a small scale
    Given a play area drawn around the box from 53.3N,-2.5W to 53.6N,-2.1W
    Then its scale is under 50 km

  Scenario: Random locations for a play area fall inside it
    Given a play area drawn as a triangle at 51N,0E / 52N,1E / 51N,1E
    When 200 random locations are drawn from it
    Then every one of them is inside the play area
