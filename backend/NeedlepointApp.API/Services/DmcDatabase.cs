using NeedlepointApp.API.Models;

namespace NeedlepointApp.API.Services;

/// <summary>
/// DMC color database with nearest-color matching via Delta-E CIE2000 in CIELAB space.
/// Upgraded from Euclidean RGB distance for perceptually accurate color matching.
/// Contains 446 DMC thread colors synced with frontend database.
/// </summary>
public static class DmcDatabase
{
    public static readonly List<DmcColor> Colors = new()
    {
        new("White", "White", 255, 255, 255),
        new("Ecru", "Ecru", 240, 234, 218),
        new("B5200", "Snow White", 255, 255, 255),
        new("150", "Ultra Dk Dusty Rose", 171,  15,  68),
        new("151", "Dusty Rose Vry Lt", 240, 195, 196),
        new("152", "Shell Pink Med Lt", 225, 148, 136),
        new("153", "Violet Very Lt", 222, 186, 209),
        new("154", "Grape Very Dk",  88,  28,  57),
        new("155", "Blue Violet Med Dk", 154, 148, 189),
        new("156", "Blue Violet Med Lt", 170, 174, 210),
        new("157", "Cornflower Blue Lt", 182, 190, 220),
        new("158", "Cornflower Blue Md Vy",  80,  90, 140),
        new("159", "Blue Gray Light", 186, 195, 216),
        new("160", "Blue Gray Medium", 150, 163, 194),
        new("161", "Blue Gray", 121, 134, 172),
        new("162", "Blue Ultra Very Light", 220, 233, 243),
        new("163", "Celadon Green Md",  88, 147, 101),
        new("164", "Forest Green Light", 193, 218, 183),
        new("165", "Moss Green Vy Lt", 234, 240, 171),
        new("166", "Moss Green Md Lt", 185, 198,  57),
        new("167", "Yellow Beige Vy Dk", 163, 118,  68),
        new("168", "Pewter Very Light", 210, 210, 210),
        new("169", "Pewter Light", 150, 150, 153),
        new("208", "Lavender Very Dark", 148,  91, 147),
        new("209", "Lavender Dark", 178, 122, 172),
        new("210", "Lavender Medium", 210, 167, 204),
        new("211", "Lavender Light", 232, 210, 230),
        new("221", "Shell Pink Very Dark", 154,  76,  79),
        new("223", "Shell Pink Light", 202, 128, 117),
        new("224", "Shell Pink Very Light", 231, 178, 165),
        new("225", "Shell Pink Ultra Vy Lt", 248, 218, 205),
        new("300", "Mahogany Very Dark", 140,  55,   0),
        new("301", "Mahogany Medium", 188,  95,  44),
        new("304", "Christmas Red Medium", 188,  28,  44),
        new("307", "Lemon", 253, 229,  90),
        new("309", "Rose Dark", 194,  60,  86),
        new("310", "Black",   0,   0,   0),
        new("311", "Navy Blue Medium",  32,  76, 107),
        new("312", "Navy Blue Light",  52, 102, 142),
        new("315", "Antique Mauve Md Dk", 160,  89, 100),
        new("316", "Antique Mauve Medium", 190, 127, 138),
        new("317", "Pewter Gray", 120, 120, 123),
        new("318", "Steel Gray Light", 174, 174, 177),
        new("319", "Pistachio Grn Vy Dk",  62, 111,  65),
        new("320", "Pistachio Green Med", 110, 153, 101),
        new("321", "Christmas Red", 198,  41,  56),
        new("322", "Navy Blue Dark",  77, 120, 163),
        new("326", "Rose Very Dark", 180,  44,  69),
        new("327", "Violet Dark", 109,  55, 110),
        new("333", "Blue Violet Very Dark",  95,  85, 145),
        new("334", "Baby Blue Medium", 114, 162, 204),
        new("335", "Rose", 230,  64, 105),
        new("336", "Navy Blue",  33,  59, 107),
        new("340", "Blue Violet Medium", 179, 164, 206),
        new("341", "Blue Violet Light", 179, 186, 218),
        new("347", "Salmon Very Dark", 191,  41,  41),
        new("349", "Coral Dark", 205,  51,  51),
        new("350", "Coral Medium", 218,  80,  73),
        new("351", "Coral", 233, 115, 101),
        new("352", "Coral Light", 246, 163, 147),
        new("353", "Peach", 254, 204, 188),
        new("355", "Terra Cotta Dark", 163,  75,  52),
        new("356", "Terra Cotta Medium", 197, 113,  88),
        new("367", "Pistachio Green Dark",  90, 130,  82),
        new("368", "Pistachio Green Light", 167, 204, 153),
        new("369", "Pistachio Grn Vy Lt", 212, 237, 201),
        new("370", "Mustard Medium", 165, 138,  68),
        new("371", "Mustard", 163, 136,  74),
        new("372", "Mustard Light", 190, 169, 111),
        new("400", "Mahogany Dark", 158,  68,  18),
        new("402", "Mahogany Very Light", 250, 176, 124),
        new("407", "Desert Sand Dark", 193, 130, 100),
        new("413", "Pewter Gray Dark",  87,  87,  91),
        new("414", "Steel Gray Dark", 143, 143, 148),
        new("415", "Pearl Gray", 210, 210, 210),
        new("420", "Hazel Nut Brown Dk", 155, 100,  48),
        new("422", "Hazel Nut Brown Lt", 204, 160, 105),
        new("434", "Brown Light", 147,  88,  45),
        new("435", "Brown Very Light", 183, 115,  63),
        new("436", "Tan", 212, 151,  87),
        new("437", "Tan Light", 232, 186, 130),
        new("444", "Lemon Dark", 254, 206,   0),
        new("445", "Lemon Light", 255, 249, 145),
        new("451", "Shell Gray Dark", 155, 138, 128),
        new("452", "Shell Gray Medium", 201, 185, 176),
        new("453", "Shell Gray Light", 218, 205, 195),
        new("469", "Avocado Green",  99, 127,  52),
        new("470", "Avocado Grn Light", 133, 168,  78),
        new("471", "Avocado Green Vy Lt", 172, 197, 120),
        new("472", "Avocado Green Ultra", 215, 226, 167),
        new("498", "Christmas Red Dark", 167,  17,  42),
        new("500", "Blue Green Very Dark",  35,  80,  53),
        new("501", "Blue Green Dark",  60, 113,  78),
        new("502", "Blue Green", 100, 153, 117),
        new("503", "Blue Green Medium", 151, 188, 165),
        new("504", "Blue Green Very Light", 193, 219, 204),
        new("517", "Wedgwood Dark",  58, 125, 162),
        new("518", "Wedgwood Light",  85, 161, 197),
        new("519", "Sky Blue", 124, 185, 214),
        new("520", "Fern Green Dark",  87, 108,  67),
        new("522", "Fern Green", 147, 164, 126),
        new("523", "Fern Green Light", 172, 188, 154),
        new("524", "Fern Green Very Light", 198, 210, 183),
        new("535", "Ash Gray Very Light",  96,  96, 104),
        new("543", "Beige Brown Vy Lt", 234, 213, 189),
        new("550", "Violet Very Dark",  96,  20,  96),
        new("552", "Violet Medium", 147,  64, 139),
        new("553", "Violet", 175,  96, 164),
        new("554", "Violet Light", 220, 170, 214),
        new("561", "Jade Very Dark",  51, 113,  78),
        new("562", "Jade Medium",  85, 151, 107),
        new("563", "Jade Light", 143, 194, 158),
        new("564", "Jade Very Light", 182, 219, 194),
        new("580", "Moss Green Dark", 103, 120,  41),
        new("581", "Moss Green", 126, 147,  55),
        new("597", "Turquoise",  81, 172, 188),
        new("598", "Turquoise Light", 145, 205, 214),
        new("600", "Cranberry Very Dark", 193,  29,  88),
        new("601", "Cranberry Dark", 204,  36, 104),
        new("602", "Cranberry Medium", 218,  57, 124),
        new("603", "Cranberry", 239, 102, 153),
        new("604", "Cranberry Light", 249, 159, 185),
        new("605", "Cranberry Very Light", 254, 196, 213),
        new("606", "Bright Orange-Red", 238,  44,  22),
        new("608", "Bright Orange", 242,  99,  34),
        new("610", "Drab Brown Dark", 130,  98,  58),
        new("611", "Drab Brown", 156, 119,  74),
        new("612", "Drab Brown Light", 190, 159, 112),
        new("613", "Drab Brown Very Light", 224, 200, 160),
        new("632", "Desert Sand Ult Vy Dk", 153,  88,  56),
        new("640", "Beige Gray Vy Dk", 139, 128, 100),
        new("642", "Beige Gray Dark", 174, 163, 136),
        new("644", "Beige Gray Medium", 217, 208, 190),
        new("645", "Beaver Gray Vy Dk", 112, 105,  97),
        new("646", "Beaver Gray Dark", 141, 132, 122),
        new("647", "Beaver Gray Medium", 175, 170, 160),
        new("648", "Beaver Gray Light", 197, 193, 183),
        new("666", "Bright Christmas Red", 224,  30,  52),
        new("676", "Old Gold Light", 225, 196, 131),
        new("677", "Old Gold Very Light", 243, 226, 176),
        new("680", "Old Gold Dark", 185, 140,  44),
        new("699", "Christmas Green",  14, 112,  30),
        new("700", "Christmas Green Bright",  22, 127,  36),
        new("701", "Christmas Green Light",  58, 152,  62),
        new("702", "Kelly Green",  80, 173,  74),
        new("703", "Chartreuse", 122, 192, 104),
        new("704", "Chartreuse Bright", 162, 211, 118),
        new("712", "Cream", 251, 244, 225),
        new("718", "Plum", 160,  22, 100),
        new("720", "Orange Spice Dark", 220,  97,  27),
        new("721", "Orange Spice Medium", 238, 130,  65),
        new("722", "Orange Spice Light", 245, 166, 108),
        new("725", "Topaz", 253, 194,  67),
        new("726", "Topaz Light", 254, 215,  96),
        new("727", "Topaz Very Light", 254, 237, 163),
        new("728", "Golden Rod", 228, 173,  82),
        new("729", "Old Gold Medium", 203, 158,  62),
        new("730", "Olive Green Very Dark", 130, 115,  20),
        new("731", "Olive Green Dark", 148, 135,  34),
        new("732", "Olive Green", 162, 148,  44),
        new("733", "Olive Green Medium", 189, 176,  79),
        new("734", "Olive Green Light", 210, 199, 120),
        new("738", "Tan Very Light", 240, 208, 159),
        new("739", "Tan Ultra Very Light", 249, 231, 198),
        new("740", "Tangerine", 253, 146,   0),
        new("741", "Tangerine Medium", 253, 174,  32),
        new("742", "Tangerine Light", 253, 201,  85),
        new("743", "Yellow Medium", 254, 224, 112),
        new("744", "Yellow Pale", 254, 237, 160),
        new("745", "Yellow Pale Light", 254, 244, 195),
        new("746", "Off White", 253, 250, 234),
        new("747", "Sky Blue Very Light", 224, 247, 253),
        new("754", "Peach Light", 247, 204, 188),
        new("758", "Terra Cotta Very Lt", 235, 179, 162),
        new("760", "Salmon", 240, 150, 135),
        new("761", "Salmon Light", 247, 188, 178),
        new("762", "Pearl Gray Very Light", 234, 234, 234),
        new("772", "Yellow Green Vy Lt", 218, 233, 195),
        new("775", "Baby Blue Very Light", 217, 235, 245),
        new("776", "Pink Medium", 249, 162, 166),
        new("778", "Antique Mauve Vy Lt", 220, 178, 175),
        new("780", "Topaz Very Dark", 151,  95,  18),
        new("781", "Topaz Dark", 169, 113,  29),
        new("782", "Topaz Medium", 190, 134,  42),
        new("783", "Christmas Gold", 212, 158,  57),
        new("791", "Cornflower Blue Vy Dk",  63,  71, 121),
        new("792", "Cornflower Blue Dark",  89, 103, 158),
        new("793", "Cornflower Blue Med", 122, 136, 185),
        new("794", "Cornflower Blue Light", 161, 174, 214),
        new("796", "Royal Blue Dark",  29,  85, 143),
        new("797", "Royal Blue",  36,  99, 162),
        new("798", "Delft Blue Dark",  70, 122, 179),
        new("799", "Delft Blue Medium", 110, 153, 199),
        new("800", "Delft Blue Pale", 170, 196, 224),
        new("801", "Coffee Brown Dark", 115,  62,  20),
        new("806", "Peacock Blue Dark",  48, 150, 175),
        new("807", "Peacock Blue",  90, 178, 198),
        new("809", "Delft Blue", 141, 173, 208),
        new("813", "Blue Light", 155, 193, 220),
        new("814", "Garnet Dark", 134,  11,  37),
        new("815", "Garnet Medium", 163,  23,  47),
        new("816", "Garnet", 187,  29,  55),
        new("817", "Coral Red Very Dark", 193,  32,  32),
        new("818", "Baby Pink", 253, 211, 210),
        new("819", "Baby Pink Light", 254, 231, 228),
        new("820", "Royal Blue Very Dark",  20,  58, 120),
        new("822", "Beige Gray Light", 234, 224, 205),
        new("823", "Navy Blue Dark",  21,  36,  91),
        new("824", "Blue Very Dark",  53, 101, 148),
        new("825", "Blue Dark",  72, 129, 175),
        new("826", "Blue Medium", 105, 162, 204),
        new("827", "Blue Very Light", 190, 218, 238),
        new("828", "Blue Ultra Very Light", 207, 232, 244),
        new("829", "Golden Olive Vy Dk", 132, 100,  30),
        new("830", "Golden Olive Dark", 152, 120,  45),
        new("831", "Golden Olive Medium", 172, 141,  63),
        new("832", "Golden Olive", 193, 159,  73),
        new("833", "Golden Olive Light", 210, 181, 105),
        new("834", "Golden Olive Vy Lt", 229, 205, 143),
        new("838", "Beige Brown Vy Dk", 103,  73,  44),
        new("839", "Beige Brown Dark", 128,  95,  64),
        new("840", "Beige Brown Medium", 162, 125,  90),
        new("841", "Beige Brown Light", 196, 163, 131),
        new("842", "Beige Brown Vy Lt", 222, 198, 170),
        new("844", "Beaver Gray Ult Dk",  82,  80,  76),
        new("869", "Hazel Nut Brn Vy Dk", 134,  83,  29),
        new("890", "Pistachio Grn Ult Dk",  36,  80,  40),
        new("891", "Carnation Dark", 240,  77,  99),
        new("892", "Carnation Medium", 247, 115, 130),
        new("893", "Carnation Light", 250, 156, 165),
        new("894", "Carnation Very Light", 253, 188, 194),
        new("895", "Hunter Green Vy Dk",  44,  84,  39),
        new("898", "Coffee Brown Vy Dk",  80,  35,   5),
        new("899", "Rose Medium", 241, 123, 137),
        new("900", "Burnt Orange Dark", 212,  74,  12),
        new("902", "Garnet Very Dark", 115,  18,  37),
        new("904", "Parrot Green Vy Dk",  78, 122,  43),
        new("905", "Parrot Green Dark",  98, 148,  52),
        new("906", "Parrot Green Medium", 130, 185,  72),
        new("907", "Parrot Green Light", 178, 218, 110),
        new("909", "Emerald Green Vy Dk",  26, 120,  64),
        new("910", "Emerald Green Dark",  35, 148,  78),
        new("911", "Emerald Green Med",  51, 168,  95),
        new("912", "Emerald Green Light",  72, 190, 116),
        new("913", "Nile Green Medium", 126, 201, 152),
        new("915", "Plum Dark", 148,  10,  76),
        new("917", "Plum Medium", 180,  24, 110),
        new("918", "Red Copper Dark", 152,  64,  22),
        new("919", "Red Copper", 182,  82,  28),
        new("920", "Copper Medium", 193, 100,  44),
        new("921", "Copper", 210, 118,  60),
        new("922", "Copper Light", 228, 150,  90),
        new("924", "Slate Green Vy Dk",  75, 106, 101),
        new("926", "Slate Green Medium", 136, 163, 159),
        new("927", "Slate Green Light", 173, 195, 193),
        new("928", "Slate Green Vy Lt", 210, 222, 220),
        new("930", "Antique Blue Dark",  80, 105, 130),
        new("931", "Antique Blue Medium", 115, 144, 168),
        new("932", "Antique Blue Light", 162, 183, 204),
        new("934", "Black Avocado Green",  64,  78,  34),
        new("935", "Avocado Green Dark",  76,  99,  40),
        new("936", "Avocado Grn Vy Dk",  86, 108,  46),
        new("937", "Avocado Green Med", 108, 137,  59),
        new("938", "Coffee Brown Ult Dk",  60,  27,   4),
        new("939", "Navy Blue Very Dark",  17,  30,  78),
        new("943", "Aquamarine Med",  55, 175, 152),
        new("945", "Tawny", 250, 199, 161),
        new("946", "Burnt Orange Medium", 237,  99,  20),
        new("947", "Burnt Orange", 252, 127,  49),
        new("948", "Peach Very Light", 253, 227, 213),
        new("950", "Desert Sand Light", 232, 186, 161),
        new("951", "Tawny Light", 251, 218, 189),
        new("954", "Nile Green", 119, 194, 144),
        new("955", "Nile Green Light", 172, 222, 189),
        new("956", "Geranium", 248, 103, 104),
        new("957", "Geranium Pale", 252, 170, 170),
        new("958", "Sea Green Dark",  47, 185, 163),
        new("959", "Sea Green Medium",  89, 199, 183),
        new("961", "Dusty Rose Dark", 216, 100, 104),
        new("962", "Dusty Rose Medium", 231, 134, 138),
        new("963", "Dusty Rose Ult Vy Lt", 253, 204, 205),
        new("964", "Sea Green Light", 161, 226, 215),
        new("966", "Baby Green Medium", 175, 216, 181),
        new("970", "Pumpkin Light", 245, 140,  41),
        new("971", "Pumpkin", 244, 120,   6),
        new("972", "Canary Deep", 253, 185,  17),
        new("973", "Canary Bright", 254, 228,  16),
        new("975", "Golden Brown Dark", 152,  84,  14),
        new("976", "Golden Brown Medium", 210, 137,  62),
        new("977", "Golden Brown Light", 232, 172,  88),
        new("986", "Forest Green Vy Dk",  62,  96,  53),
        new("987", "Forest Green Dark",  89, 131,  73),
        new("988", "Forest Green Medium", 123, 163, 103),
        new("989", "Forest Green", 155, 190, 131),
        new("991", "Aquamarine Dk",  58, 130, 112),
        new("992", "Aquamarine",  96, 176, 157),
        new("993", "Aquamarine Lt", 142, 204, 187),
        new("995", "Electric Blue Dark",  34, 154, 204),
        new("996", "Electric Blue Medium",  48, 192, 240),
        new("3011", "Khaki Green Dk", 124, 120,  60),
        new("3012", "Khaki Green Md", 158, 154,  84),
        new("3013", "Khaki Green Lt", 192, 188, 136),
        new("3021", "Brown Gray Vy Dk",  84,  74,  60),
        new("3022", "Brown Gray Medium", 143, 143, 118),
        new("3023", "Brown Gray Light", 184, 180, 160),
        new("3024", "Brown Gray Vy Lt", 230, 228, 216),
        new("3031", "Mocha Brown Vy Dk",  82,  58,  30),
        new("3032", "Mocha Brown Med", 176, 150, 118),
        new("3033", "Mocha Brown Vy Lt", 224, 206, 180),
        new("3041", "Antique Violet Med", 156, 122, 142),
        new("3042", "Antique Violet Lt", 198, 169, 184),
        new("3045", "Yellow Beige Dk", 192, 148,  88),
        new("3046", "Yellow Beige Md", 218, 184, 130),
        new("3047", "Yellow Beige Lt", 237, 215, 174),
        new("3051", "Green Gray Dark",  88,  99,  60),
        new("3052", "Green Gray Med", 128, 143,  96),
        new("3053", "Green Gray", 163, 176, 131),
        new("3064", "Desert Sand", 199, 149, 116),
        new("3072", "Beaver Gray Vy Lt", 229, 228, 224),
        new("3325", "Baby Blue Light", 185, 212, 234),
        new("3326", "Rose Light", 250, 183, 184),
        new("3328", "Salmon Dark", 218, 100,  90),
        new("3340", "Apricot Medium", 248, 127,  89),
        new("3341", "Apricot", 251, 165, 131),
        new("3345", "Hunter Green Dark",  52, 104,  38),
        new("3346", "Hunter Green",  78, 140,  60),
        new("3347", "Yellow Green Med", 117, 170,  96),
        new("3348", "Yellow Green Light", 193, 218, 168),
        new("3350", "Dusty Rose Ult Dk", 192,  60,  88),
        new("3354", "Dusty Rose Light", 229, 163, 165),
        new("3362", "Pine Green Dark",  88, 108,  64),
        new("3363", "Pine Green Medium", 112, 138,  85),
        new("3364", "Pine Green", 142, 170, 112),
        new("3371", "Black Brown",  38,  19,   5),
        new("3607", "Plum Light", 202,  68, 148),
        new("3608", "Plum Very Light", 232, 146, 196),
        new("3609", "Plum Ultra Light", 247, 193, 228),
        new("3685", "Mauve Very Dark", 144,  33,  63),
        new("3687", "Mauve", 194, 101, 115),
        new("3688", "Mauve Medium", 220, 155, 163),
        new("3689", "Mauve Light", 244, 192, 198),
        new("3705", "Watermelon Dark", 253,  82,  97),
        new("3706", "Watermelon Medium", 254, 136, 145),
        new("3708", "Watermelon Light", 254, 188, 194),
        new("3712", "Salmon Medium", 236, 117, 104),
        new("3713", "Salmon Very Light", 253, 220, 214),
        new("3721", "Shell Pink Dark", 172,  80,  84),
        new("3722", "Shell Pink Medium", 192, 104, 100),
        new("3726", "Antique Mauve Dark", 163,  90, 106),
        new("3727", "Antique Mauve Lt", 232, 190, 196),
        new("3731", "Dusty Rose Vy Dk", 213,  79, 104),
        new("3733", "Dusty Rose", 236, 125, 140),
        new("3740", "Antique Violet Dark", 120,  88, 112),
        new("3743", "Antique Violet Vy Lt", 220, 208, 218),
        new("3746", "Blue Violet Dark", 130, 118, 184),
        new("3747", "Blue Violet Very Light", 214, 216, 238),
        new("3750", "Antique Blue Vy Dk",  50,  76, 107),
        new("3752", "Antique Blue Vy Lt", 198, 212, 228),
        new("3753", "Antique Blue Ult Vy Lt", 220, 230, 242),
        new("3755", "Baby Blue", 138, 181, 218),
        new("3756", "Baby Blue Ult Vy Lt", 237, 247, 253),
        new("3760", "Wedgwood Medium",  62, 131, 168),
        new("3761", "Sky Blue Light", 168, 214, 232),
        new("3765", "Peacock Blue Vy Dk",  38, 126, 152),
        new("3766", "Peacock Blue Light", 124, 196, 214),
        new("3768", "Slate Green Dark", 102, 132, 130),
        new("3770", "Tawny Very Light", 254, 232, 212),
        new("3771", "Terra Cotta Ult Lt", 247, 196, 175),
        new("3772", "Desert Sand Vy Dk", 170, 106,  74),
        new("3773", "Desert Sand Med", 210, 152, 116),
        new("3774", "Desert Sand Vy Lt", 245, 220, 202),
        new("3776", "Mahogany Light", 217, 119,  61),
        new("3777", "Terra Cotta Vy Dk", 143,  48,  32),
        new("3778", "Terra Cotta Lt", 221, 147, 126),
        new("3779", "Terra Cotta Ult Lt", 249, 205, 192),
        new("3781", "Mocha Brown Dark", 120,  86,  56),
        new("3782", "Mocha Brown Lt", 213, 188, 156),
        new("3787", "Brown Gray Dark", 104,  96,  78),
        new("3790", "Beige Gray Ult Dk", 124, 104,  76),
        new("3799", "Pewter Gray Vy Dk",  64,  63,  66),
        new("3801", "Live Red Lt", 234,  43,  72),
        new("3802", "Antique Mauve Vy Dk", 135,  64,  82),
        new("3803", "Mauve Dark", 167,  42,  82),
        new("3804", "Cycl Pink Dark", 224,  26, 114),
        new("3805", "Cycl Pink", 238,  56, 145),
        new("3806", "Cycl Pink Light", 248, 119, 182),
        new("3807", "Cornflower Blue", 100, 110, 164),
        new("3808", "Turquoise Ult Vy Dk",  60, 117, 130),
        new("3809", "Turquoise Vy Dk",  75, 147, 161),
        new("3810", "Turquoise Dark",  96, 172, 185),
        new("3811", "Turquoise Very Light", 188, 228, 235),
        new("3812", "Sea Green Vy Dk",  44, 146, 130),
        new("3813", "Blue Green Light", 179, 219, 202),
        new("3814", "Aquamarine",  62, 151, 130),
        new("3815", "Celadon Green Dk",  67, 126,  88),
        new("3816", "Celadon Green", 101, 163, 120),
        new("3817", "Celadon Green Lt", 155, 198, 168),
        new("3818", "Emerald Green Ult Vy",  16, 104,  56),
        new("3819", "Moss Green Lt", 222, 228, 130),
        new("3820", "Straw Dark", 217, 175,  74),
        new("3821", "Straw", 241, 206, 103),
        new("3822", "Straw Light", 247, 223, 153),
        new("3823", "Yellow Ultra Pale", 254, 250, 219),
        new("3824", "Apricot Light", 253, 192, 166),
        new("3825", "Pumpkin Pale", 253, 187, 139),
        new("3826", "Golden Brown", 183, 111,  48),
        new("3827", "Golden Brown Pale", 247, 190, 120),
        new("3828", "Hazel Nut Brown", 179, 130,  78),
        new("3829", "Old Gold Very Dark", 163, 120,  12),
        new("3830", "Terra Cotta", 185,  82,  66),
        new("3831", "Raspberry Dark", 180,  36,  60),
        new("3832", "Raspberry Medium", 210,  62,  88),
        new("3833", "Raspberry Light", 233, 128, 148),
        new("3834", "Grape Dark", 120,  45,  96),
        new("3835", "Grape Medium", 155,  82, 138),
        new("3836", "Grape Light", 196, 143, 188),
        new("3837", "Lavender Ultra Dark", 113,  55, 120),
        new("3838", "Lavender Blue Dark",  88, 108, 168),
        new("3839", "Lavender Blue Med", 124, 142, 195),
        new("3840", "Lavender Blue Light", 176, 188, 224),
        new("3841", "Baby Blue Pale", 213, 232, 246),
        new("3842", "Wedgwood Dark",  46, 112, 148),
        new("3843", "Electric Blue",  16, 170, 214),
        new("3844", "Bright Turquoise Dark",  20, 176, 196),
        new("3845", "Bright Turquoise Med",  10, 196, 210),
        new("3846", "Bright Turquoise Light",  20, 218, 228),
        new("3847", "Teal Green Dark",  52, 130, 120),
        new("3848", "Teal Green Medium",  84, 162, 152),
        new("3849", "Teal Green Light", 119, 192, 180),
        new("3850", "Bright Green Dark",  48, 138, 108),
        new("3851", "Bright Green Light",  80, 180, 146),
        new("3852", "Straw Very Dark", 196, 149,  38),
        new("3853", "Autumn Gold Dark", 242, 146,  56),
        new("3854", "Autumn Gold Med", 247, 177,  97),
        new("3855", "Autumn Gold Light", 252, 210, 148),
        new("3856", "Mahogany Ult Vy Lt", 255, 210, 178),
        new("3857", "Rosewood Dark",  84,  22,  10),
        new("3858", "Rosewood Medium", 158,  72,  60),
        new("3859", "Rosewood Light", 198, 136, 116),
        new("3860", "Cocoa", 118,  86,  80),
        new("3861", "Cocoa Light", 167, 135, 129),
        new("3862", "Mocha Beige Dark", 132, 101,  64),
        new("3863", "Mocha Beige Medium", 161, 128,  90),
        new("3864", "Mocha Beige Light", 202, 175, 140),
        new("3865", "Winter White", 252, 250, 244),
        new("3866", "Mocha Brown Ult Lt", 247, 242, 233),
    };

    // Pre-computed CIELAB values for all colors (computed at static init time)
    private static readonly (double L, double A, double B)[] LabValues =
        Colors.Select(c => RgbToLab(c.R, c.G, c.B)).ToArray();

    /// <summary>
    /// Find the nearest DMC color using Delta-E CIE2000 (perceptually accurate).
    /// </summary>
    public static DmcColor FindNearest(int r, int g, int b)
    {
        var targetLab = RgbToLab(r, g, b);
        DmcColor? nearest = null;
        double minDist = double.MaxValue;

        for (int i = 0; i < Colors.Count; i++)
        {
            double dist = DeltaE2000(targetLab, LabValues[i]);
            if (dist < minDist)
            {
                minDist = dist;
                nearest = Colors[i];
                if (dist < 0.5) break; // close enough
            }
        }

        return nearest!;
    }

    /// <summary>
    /// Find the nearest DMC color from a restricted set.
    /// </summary>
    public static DmcColor FindNearest(int r, int g, int b, IEnumerable<DmcColor> allowed)
    {
        return FindNearestWithDeltaE(r, g, b, allowed).Color;
    }

    /// <summary>
    /// Find the nearest DMC color with Delta-E distance (full database).
    /// </summary>
    public static (DmcColor Color, double DeltaE) FindNearestWithDeltaE(int r, int g, int b)
    {
        var targetLab = RgbToLab(r, g, b);
        DmcColor? nearest = null;
        double minDist = double.MaxValue;

        for (int i = 0; i < Colors.Count; i++)
        {
            double dist = DeltaE2000(targetLab, LabValues[i]);
            if (dist < minDist)
            {
                minDist = dist;
                nearest = Colors[i];
                if (dist < 0.5) break;
            }
        }

        return (nearest!, minDist);
    }

    /// <summary>
    /// Find the nearest DMC color with Delta-E distance from a restricted set.
    /// </summary>
    public static (DmcColor Color, double DeltaE) FindNearestWithDeltaE(int r, int g, int b, IEnumerable<DmcColor> allowed)
    {
        var targetLab = RgbToLab(r, g, b);
        DmcColor? nearest = null;
        double minDist = double.MaxValue;

        foreach (var color in allowed)
        {
            var colorLab = RgbToLab(color.R, color.G, color.B);
            double dist = DeltaE2000(targetLab, colorLab);
            if (dist < minDist)
            {
                minDist = dist;
                nearest = color;
            }
        }

        return (nearest!, minDist);
    }

    // ── Color Science: RGB → XYZ → CIELAB ──

    private static (double L, double A, double B) RgbToLab(int r, int g, int b)
    {
        // sRGB → linear RGB (inverse companding)
        double rl = r / 255.0;
        double gl = g / 255.0;
        double bl = b / 255.0;

        rl = rl > 0.04045 ? Math.Pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
        gl = gl > 0.04045 ? Math.Pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
        bl = bl > 0.04045 ? Math.Pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

        rl *= 100; gl *= 100; bl *= 100;

        // Linear RGB → XYZ (sRGB matrix, D65)
        double x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
        double y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
        double z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

        // XYZ → CIELAB (D65 reference white)
        double fx = x / 95.047;
        double fy = y / 100.0;
        double fz = z / 108.883;

        const double epsilon = 0.008856;
        const double kappa = 7.787;

        fx = fx > epsilon ? Math.Cbrt(fx) : kappa * fx + 16.0 / 116.0;
        fy = fy > epsilon ? Math.Cbrt(fy) : kappa * fy + 16.0 / 116.0;
        fz = fz > epsilon ? Math.Cbrt(fz) : kappa * fz + 16.0 / 116.0;

        return (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz));
    }

    // ── Delta-E CIE2000 ──

    private static double DeltaE2000(
        (double L, double A, double B) lab1,
        (double L, double A, double B) lab2)
    {
        double C1 = Math.Sqrt(lab1.A * lab1.A + lab1.B * lab1.B);
        double C2 = Math.Sqrt(lab2.A * lab2.A + lab2.B * lab2.B);
        double CabMean = (C1 + C2) / 2.0;

        double CabMeanPow7 = Math.Pow(CabMean, 7);
        double G = 0.5 * (1.0 - Math.Sqrt(CabMeanPow7 / (CabMeanPow7 + 6103515625.0)));

        double a1p = lab1.A * (1.0 + G);
        double a2p = lab2.A * (1.0 + G);

        double C1p = Math.Sqrt(a1p * a1p + lab1.B * lab1.B);
        double C2p = Math.Sqrt(a2p * a2p + lab2.B * lab2.B);

        double h1p = Math.Atan2(lab1.B, a1p) * (180.0 / Math.PI);
        if (h1p < 0) h1p += 360.0;
        double h2p = Math.Atan2(lab2.B, a2p) * (180.0 / Math.PI);
        if (h2p < 0) h2p += 360.0;

        double dLp = lab2.L - lab1.L;
        double dCp = C2p - C1p;

        double dhp;
        if (C1p * C2p == 0) dhp = 0;
        else if (Math.Abs(h2p - h1p) <= 180) dhp = h2p - h1p;
        else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
        else dhp = h2p - h1p + 360;

        double dHp = 2.0 * Math.Sqrt(C1p * C2p) * Math.Sin(dhp * Math.PI / 360.0);

        double LpMean = (lab1.L + lab2.L) / 2.0;
        double CpMean = (C1p + C2p) / 2.0;

        double hpMean;
        if (C1p * C2p == 0) hpMean = h1p + h2p;
        else if (Math.Abs(h1p - h2p) <= 180) hpMean = (h1p + h2p) / 2.0;
        else if (h1p + h2p < 360) hpMean = (h1p + h2p + 360) / 2.0;
        else hpMean = (h1p + h2p - 360) / 2.0;

        double T = 1.0
            - 0.17 * Math.Cos((hpMean - 30) * Math.PI / 180.0)
            + 0.24 * Math.Cos(2.0 * hpMean * Math.PI / 180.0)
            + 0.32 * Math.Cos((3.0 * hpMean + 6) * Math.PI / 180.0)
            - 0.20 * Math.Cos((4.0 * hpMean - 63) * Math.PI / 180.0);

        double LpMeanMinus50Sq = (LpMean - 50) * (LpMean - 50);
        double SL = 1.0 + 0.015 * LpMeanMinus50Sq / Math.Sqrt(20 + LpMeanMinus50Sq);
        double SC = 1.0 + 0.045 * CpMean;
        double SH = 1.0 + 0.015 * CpMean * T;

        double CpMeanPow7 = Math.Pow(CpMean, 7);
        double RT = -2.0
            * Math.Sqrt(CpMeanPow7 / (CpMeanPow7 + 6103515625.0))
            * Math.Sin(60.0 * Math.Exp(-Math.Pow((hpMean - 275) / 25.0, 2)) * Math.PI / 180.0);

        return Math.Sqrt(
            (dLp / SL) * (dLp / SL) +
            (dCp / SC) * (dCp / SC) +
            (dHp / SH) * (dHp / SH) +
            RT * (dCp / SC) * (dHp / SH));
    }
}
